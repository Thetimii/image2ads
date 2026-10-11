/**
 * Generation pipeline: start -> (kie.ai renders) -> sync -> completed | failed.
 *
 *   generate        startGeneration(): price, atomically charge + mark
 *                   processing (start_job RPC), create the kie.ai task with a
 *                   signed callBackUrl.
 *   kie-callback    kie.ai tells us a task finished -> syncJob()
 *   check-job-status browser poll -> syncJob() (throttled, mostly a DB read)
 *   sweep-stuck-jobs backstop for jobs nobody resolved -> syncJob()
 *
 * syncJob() is the only code that finishes a job. It always re-reads the task
 * from kie.ai (never trusts callback bodies) and every terminal transition is
 * a conditional UPDATE ... WHERE status = 'processing', so concurrent callers
 * (callback + poll + sweep) can't double-complete, double-refund or
 * double-log. Storage keys are deterministic, so a duplicate upload just
 * overwrites the same object.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildSpec, FREE_DAILY_CREDITS, kieCreditsToUsd, resultTypeOf, type GenerateOptions } from "./catalog.ts";
import { createTask, getTask, KieError, type KieTask } from "./kie.ts";
import { classifyFailure, friendlyMessage, sanitizePromptForRetry, type FailureCategory } from "./errors.ts";
import { jobCallbackToken } from "./signing.ts";
import { log, logError } from "./http.ts";

let _db: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _db;
}

export interface JobRow {
  id: string;
  user_id: string;
  status: string;
  prompt: string | null;
  result_type: string | null;
  has_images: boolean | null;
  image_ids: string[] | null;
  aspect_ratio: string | null;
  music_options: Record<string, unknown> | null;
  custom_name: string | null;
  task_id: string | null;
  result_url: string | null;
  cover_url: string | null;
  error_message: string | null;
  credits_used: number | null;
  retry_count: number | null;
  product_model: string | null;
  provider_model: string | null;
  provider_request: { model: string; input: Record<string, unknown> } | null;
  provider_checked_at: string | null;
  charged_at: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string | null;
}

const JOB_COLUMNS =
  "id,user_id,status,prompt,result_type,has_images,image_ids,aspect_ratio,music_options,custom_name,task_id,result_url,cover_url,error_message,credits_used,retry_count,product_model,provider_model,provider_request,provider_checked_at,charged_at,started_at,created_at,updated_at";

/** Give up on a task kie.ai hasn't finished after this long (refund). */
export const TIMEOUT_MS: Record<string, number> = {
  image: 15 * 60_000,
  music: 15 * 60_000,
  video: 30 * 60_000,
};
/** A job charged but without a kie task after this long crashed mid-start. */
export const ORPHAN_AFTER_MS = 3 * 60_000;
/** Extra time for a finished render we couldn't download/store yet (kie.ai
 * keeps files 14 days, so transient storage errors get several retries). */
export const STORE_GRACE_MS = 15 * 60_000;
/** A pending job (browser never called generate) is abandoned after this. */
export const ABANDONED_AFTER_MS = 10 * 60_000;
/** Signed reference-image URLs must outlive kie.ai's queue. */
const SOURCE_URL_TTL_SEC = 6 * 60 * 60;

export async function loadJob(jobId: string): Promise<JobRow | null> {
  const { data, error } = await db().from("jobs").select(JOB_COLUMNS).eq("id", jobId).maybeSingle();
  if (error) throw new Error(`load job ${jobId}: ${error.message}`);
  return data as JobRow | null;
}

export function isTerminal(status: string): boolean {
  return status === "completed" || status === "failed";
}

function callbackUrlFor(jobId: string, token: string): string {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  return `${base}/functions/v1/kie-callback?job=${encodeURIComponent(jobId)}&sig=${encodeURIComponent(token)}`;
}

async function signedSourceUrls(job: JobRow): Promise<string[]> {
  const ids = Array.isArray(job.image_ids) ? job.image_ids.filter(Boolean) : [];
  if (ids.length === 0) return [];
  const { data: images, error } = await db().from("images").select("id,file_path").in("id", ids).eq("user_id", job.user_id);
  if (error) throw new Error(`load source images: ${error.message}`);
  // keep the order the user picked them in
  const byId = new Map((images ?? []).map((i: { id: string; file_path: string }) => [i.id, i.file_path]));
  const urls: string[] = [];
  for (const id of ids) {
    const path = byId.get(id);
    // file_path is browser-supplied: only ever sign the job owner's own files.
    if (!path || path === "text-only-placeholder" || !path.startsWith(`${job.user_id}/`)) continue;
    for (const bucket of ["uploads", "results"]) {
      const { data } = await db().storage.from(bucket).createSignedUrl(path, SOURCE_URL_TTL_SEC);
      if (data?.signedUrl) {
        urls.push(data.signedUrl);
        break;
      }
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export type StartResult =
  | { http: 200; body: { success: true; jobId: string; taskId: string | null; status: string; result_type: string } }
  | { http: 400 | 402 | 404 | 429 | 500 | 503; body: { success: false; error: string; code: string; jobId?: string } };

export async function startGeneration(job: JobRow, opts: GenerateOptions): Promise<StartResult> {
  const resultType = resultTypeOf(job);

  // Idempotent: a double-click or client retry just reports the current state.
  if (job.status !== "pending") {
    return { http: 200, body: { success: true, jobId: job.id, taskId: job.task_id, status: job.status, result_type: resultType } };
  }

  const { data: profile, error: pErr } = await db().from("profiles").select("subscription_status").eq("id", job.user_id).maybeSingle();
  if (pErr || !profile) return { http: 404, body: { success: false, error: "Profile not found", code: "PROFILE_NOT_FOUND", jobId: job.id } };
  const paid = profile.subscription_status === "active" || profile.subscription_status === "trialing";

  // Older callers didn't always set has_images; image_ids is authoritative.
  if (!job.has_images && Array.isArray(job.image_ids) && job.image_ids.length > 0) job = { ...job, has_images: true };

  let sourceUrls: string[] = [];
  if (resultType !== "music" && job.has_images) {
    sourceUrls = await signedSourceUrls(job);
    if (sourceUrls.length === 0) {
      await failJob(job.id, "invalid_input", "reference images not found", undefined, { requireStatus: "pending" });
      return { http: 400, body: { success: false, error: friendlyMessage("invalid_input"), code: "IMAGE_NOT_FOUND", jobId: job.id } };
    }
  }

  const spec = buildSpec(job, opts, { paid }, sourceUrls);

  // Atomic: lock job, deduct credits (if any), mark processing.
  const { data: started, error: sErr } = await db().rpc("start_job", {
    job_uuid: job.id,
    p_credits: spec.chargeCredits,
    p_billing_tier: spec.billingTier,
    p_product_model: spec.productModel,
    p_provider_model: spec.kieModel,
    p_provider_request: { model: spec.kieModel, input: spec.input },
  });
  if (sErr) throw new Error(`start_job: ${sErr.message}`);
  if (started === "insufficient_credits") {
    const msg = paid
      ? friendlyMessage("insufficient_credits")
      : `You've used today's ${FREE_DAILY_CREDITS} free images. They refill tomorrow — or upgrade to keep creating now.`;
    await failJob(job.id, "insufficient_credits", "insufficient credits", msg, { requireStatus: "pending" });
    return { http: 402, body: { success: false, error: msg, code: paid ? "INSUFFICIENT_CREDITS" : "FREE_LIMIT_REACHED", jobId: job.id } };
  }
  if (started !== "ok") {
    const fresh = await loadJob(job.id);
    return { http: 200, body: { success: true, jobId: job.id, taskId: fresh?.task_id ?? null, status: fresh?.status ?? "processing", result_type: resultType } };
  }

  let taskId: string;
  try {
    const token = await jobCallbackToken(job.id, Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "");
    taskId = await createTask(spec.kieModel, spec.input, callbackUrlFor(job.id, token));
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const category = err instanceof KieError && err.code === 402 ? "provider_unavailable" : classifyFailure(raw, err instanceof KieError ? err.code : null);
    logError("generate", "create_task_failed", err, { jobId: job.id, model: spec.kieModel });
    await failJob(job.id, category, raw, undefined, { requireNoTask: true });
    const http = category === "provider_unavailable" ? 503 : category === "invalid_input" || category === "safety_filter" ? 400 : 500;
    return { http, body: { success: false, error: friendlyMessage(category), code: category.toUpperCase(), jobId: job.id } };
  }

  const { data: attached } = await db()
    .from("jobs")
    .update({ task_id: taskId, updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "processing")
    .is("task_id", null)
    .select("id")
    .maybeSingle();
  if (!attached) {
    // Should be impossible now that orphan detection waits ORPHAN_AFTER_MS
    // from started_at, but if it happens kie.ai bills a task nobody owns.
    logError("generate", "task_not_attached", new Error("job left processing before task attached"), { jobId: job.id, taskId });
  }
  await db().from("usage_events").insert({
    user_id: job.user_id,
    event_type: job.has_images ? `image-to-${resultType}` : `text-to-${resultType}`,
    credits_consumed: spec.chargeCredits,
    job_id: job.id,
    metadata: { product_model: spec.productModel, provider_model: spec.kieModel, billing_tier: spec.billingTier },
  });
  log("generate", "task_created", { jobId: job.id, taskId, model: spec.kieModel, credits: spec.chargeCredits, tier: spec.billingTier });
  return { http: 200, body: { success: true, jobId: job.id, taskId, status: "processing", result_type: resultType } };
}

// ---------------------------------------------------------------------------
// Fail / refund
// ---------------------------------------------------------------------------

export interface FailOptions {
  /** only fail if the job is still in this status (e.g. "pending") */
  requireStatus?: "pending" | "processing";
  /** only fail if no kie.ai task is attached yet */
  requireNoTask?: boolean;
  providerCredits?: number | null;
}

/**
 * Moves a non-terminal job to failed AND refunds whatever it was charged, in
 * one transaction (fail_job RPC). Returns false if the job was already
 * resolved or didn't match the conditions (no-op).
 */
export async function failJob(
  jobId: string,
  category: FailureCategory,
  raw?: string,
  userMessage?: string,
  opts: FailOptions = {},
): Promise<boolean> {
  const { data, error } = await db().rpc("fail_job", {
    job_uuid: jobId,
    p_message: userMessage ?? friendlyMessage(category),
    p_category: category,
    p_provider_error: raw ?? null,
    p_require_status: opts.requireStatus ?? null,
    p_require_no_task: opts.requireNoTask ?? false,
    p_provider_credits: opts.providerCredits ?? null,
    p_provider_cost_usd: opts.providerCredits == null ? null : kieCreditsToUsd(opts.providerCredits),
  });
  if (error) {
    logError("pipeline", "fail_job_error", error, { jobId });
    return false;
  }
  if (!data) return false;
  if (category === "safety_filter") {
    const { data: j } = await db().from("jobs").select("user_id,prompt").eq("id", jobId).maybeSingle();
    if (j) {
      await db().from("usage_events").insert({
        user_id: (j as { user_id: string }).user_id,
        event_type: "safety_filter_rejected",
        credits_consumed: 0,
        job_id: jobId,
        metadata: { prompt: (j as { prompt: string | null }).prompt, raw_error: raw?.slice(0, 500) },
      });
    }
  }
  log("pipeline", "job_failed", { jobId, category, raw: raw?.slice(0, 200) });
  return true;
}

// ---------------------------------------------------------------------------
// Sync (the only path that completes jobs)
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** who asked - for logs */
  source: "callback" | "poll" | "sweep";
  /** skip the kie.ai lookup if we checked within this many ms */
  minRecheckMs?: number;
}

export async function syncJob(jobId: string, opts: SyncOptions): Promise<JobRow | null> {
  const job = await loadJob(jobId);
  if (!job || isTerminal(job.status)) return job;

  // Ages count from when generation actually started (start_job / safety
  // retry), never from browser-side insert time.
  const since = (iso: string | null | undefined) => (iso ? Date.now() - new Date(iso).getTime() : 0);
  const age = since(job.started_at ?? job.updated_at ?? job.created_at);
  const timeout = TIMEOUT_MS[resultTypeOf(job)] ?? TIMEOUT_MS.image;

  if (!job.task_id) {
    if (job.status === "pending") {
      // Browser never called generate (closed tab) - nothing was charged.
      if (since(job.created_at) > ABANDONED_AFTER_MS) {
        await failJob(job.id, "unknown", "abandoned before start", "Generation was not started. Please try again.", { requireStatus: "pending" });
        return await loadJob(jobId);
      }
      return job;
    }
    // Charged but no task: crashed between start_job and createTask (or a
    // safety retry is mid-submit). createTask gives up well within this.
    if (age > ORPHAN_AFTER_MS) {
      await failJob(job.id, "unknown", "no provider task was created", "Generation failed to start — no credits were used. Please try again.", { requireNoTask: true });
      return await loadJob(jobId);
    }
    return job;
  }

  if (opts.minRecheckMs && job.provider_checked_at && Date.now() - new Date(job.provider_checked_at).getTime() < opts.minRecheckMs) {
    return job;
  }

  let task: KieTask;
  try {
    task = await getTask(job.task_id);
  } catch (err) {
    logError("sync", "get_task_failed", err, { jobId, taskId: job.task_id, source: opts.source });
    // 422 = kie.ai has no such task (never accepted). Anything else is transient.
    if ((err instanceof KieError && err.code === 422 && age > ORPHAN_AFTER_MS) || age > timeout) {
      await failJob(job.id, age > timeout ? "timeout" : "unknown", err instanceof Error ? err.message : String(err));
      return await loadJob(jobId);
    }
    return job;
  }

  await db().from("jobs").update({ provider_checked_at: new Date().toISOString() }).eq("id", job.id).eq("status", "processing");

  if (task.state === "success") {
    const stored = await completeJob(job, task, opts);
    // A finished render we can't store (download/upload keeps failing) must
    // not sit in processing forever: refund once well past the timeout.
    if (!stored && age > timeout + STORE_GRACE_MS) {
      await failJob(job.id, "unknown", "result could not be stored", undefined, { providerCredits: task.creditsConsumed });
    }
  } else if (task.state === "fail") {
    await handleProviderFailure(job, task);
  } else if (age > timeout) {
    await failJob(job.id, "timeout", `still ${task.state} after ${Math.round(age / 1000)}s`);
  }
  return await loadJob(jobId);
}

async function handleProviderFailure(job: JobRow, task: KieTask): Promise<void> {
  const raw = [task.failCode, task.failMsg].filter(Boolean).join(": ") || "provider reported failure";
  const category = classifyFailure(task.failMsg, task.failCode);

  // One free retry with a softened prompt for image safety rejections - the
  // credit already charged covers it.
  if (category === "safety_filter" && (job.retry_count ?? 0) === 0 && resultTypeOf(job) === "image" && job.provider_request) {
    // Claim the retry first so a concurrent callback + poll can't both
    // submit (and pay for) a retry task. Clearing task_id + restarting the
    // clock keeps orphan detection correct while the new task is submitted.
    const input = { ...job.provider_request.input, prompt: sanitizePromptForRetry(job.prompt ?? "") };
    const { data: claimed } = await db()
      .from("jobs")
      .update({ retry_count: 1, task_id: null, started_at: new Date().toISOString(), provider_checked_at: null, provider_request: { model: job.provider_request.model, input } })
      .eq("id", job.id)
      .eq("status", "processing")
      .eq("retry_count", 0)
      .eq("task_id", job.task_id ?? "")
      .select("id")
      .maybeSingle();
    if (!claimed) return; // someone else is already handling this failure
    try {
      const token = await jobCallbackToken(job.id, Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "");
      const newTaskId = await createTask(job.provider_request.model, input, callbackUrlFor(job.id, token));
      await db().from("jobs").update({ task_id: newTaskId }).eq("id", job.id).eq("status", "processing").is("task_id", null);
      log("sync", "safety_retry", { jobId: job.id, oldTask: job.task_id, newTask: newTaskId });
      return;
    } catch (err) {
      logError("sync", "safety_retry_failed", err, { jobId: job.id });
    }
  }
  await failJob(job.id, category, raw, undefined, { providerCredits: task.creditsConsumed ?? 0 });
}

function pickMedia(resultType: string, urls: string[]): string | null {
  if (urls.length === 0) return null;
  const re = resultType === "video" ? /\.(mp4|mov|webm)(\?|$)/i : resultType === "music" ? /\.(mp3|wav|m4a|ogg)(\?|$)/i : /\.(png|jpe?g|webp)(\?|$)/i;
  return urls.find((u) => re.test(u)) ?? urls[0];
}

const SIGNATURES: Array<{ ext: string; type: string; test: (b: Uint8Array) => boolean }> = [
  { ext: "png", type: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "jpg", type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "webp", type: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 },
  { ext: "mp4", type: "video/mp4", test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  { ext: "mp3", type: "audio/mpeg", test: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
];

export function sniff(bytes: Uint8Array, fallback: string): { ext: string; type: string } {
  const hit = SIGNATURES.find((s) => bytes.length > 12 && s.test(bytes));
  if (hit) return hit;
  if (fallback === "video") return { ext: "mp4", type: "video/mp4" };
  if (fallback === "music") return { ext: "mp3", type: "audio/mpeg" };
  return { ext: "png", type: "image/png" };
}

async function download(url: string, timeoutMs: number): Promise<Uint8Array> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`download ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** Returns true if the result is stored and the job is (now) completed. */
async function completeJob(job: JobRow, task: KieTask, opts: SyncOptions): Promise<boolean> {
  const resultType = resultTypeOf(job);
  const url = pickMedia(resultType, task.resultUrls);
  if (!url) {
    await failJob(job.id, "unknown", `success without result url: ${JSON.stringify(task).slice(0, 500)}`);
    return true;
  }

  let bytes: Uint8Array;
  try {
    bytes = await download(url, resultType === "image" ? 60_000 : 120_000);
  } catch (err) {
    // Leave the job processing: kie.ai keeps files for 14 days, so the next
    // poll / sweep can try again. The timeout path refunds if it never works.
    logError("sync", "download_failed", err, { jobId: job.id, url });
    return false;
  }

  // The library (api/generated-ads) lists results by extension: .png / .mp4 /
  // .mp3, with music covers at <name>_cover.jpg. Keep those names; the real
  // content type is sniffed from the bytes.
  const { type } = sniff(bytes, resultType);
  const ext = resultType === "video" ? "mp4" : resultType === "music" ? "mp3" : "png";
  const folder = resultType === "music" ? "text-to-music" : `${job.has_images ? "image" : "text"}-to-${resultType}`;
  const key = `${job.user_id}/${folder}/${job.id}.${ext}`;
  const up = await db().storage.from("results").upload(key, bytes, { contentType: type, upsert: true });
  if (up.error) {
    logError("sync", "upload_failed", up.error, { jobId: job.id, key });
    return false; // retried by the next sync
  }

  let coverKey: string | null = null;
  if (resultType === "music" && task.coverUrls[0]) {
    try {
      const cover = await download(task.coverUrls[0], 30_000);
      const c = sniff(cover, "image");
      coverKey = `${job.user_id}/text-to-music/${job.id}_cover.jpg`;
      const cu = await db().storage.from("results").upload(coverKey, cover, { contentType: c.type, upsert: true });
      if (cu.error) coverKey = null;
    } catch {
      coverKey = null; // cover art is optional
    }
  }

  const credits = task.creditsConsumed;
  const { data: won } = await db()
    .from("jobs")
    .update({
      status: "completed",
      result_url: key,
      cover_url: coverKey,
      error_message: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider_credits: credits,
      provider_cost_usd: credits == null ? null : kieCreditsToUsd(credits),
    })
    .eq("id", job.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (!won) {
    // Lost the race. If the job was completed by another caller it points at
    // this same key - keep it. If it was failed (and refunded) meanwhile,
    // remove what we just uploaded so the library doesn't show a refunded
    // result.
    const now = await loadJob(job.id);
    if (now?.status === "failed") {
      await db().storage.from("results").remove([key, ...(coverKey ? [coverKey] : [])]);
    }
    return now?.status === "completed";
  }

  // Library metadata (folder_id null = shows in the main library, as before).
  const { error: mErr } = await db().from("generated_ads_metadata").upsert({
    file_name: key.split("/").pop(),
    custom_name: (job.custom_name || job.prompt || "Generated ad").slice(0, 200),
    user_id: job.user_id,
    folder_id: null,
  }, { onConflict: "file_name" });
  if (mErr) logError("sync", "metadata_failed", mErr, { jobId: job.id });

  log("sync", "job_completed", {
    jobId: job.id,
    source: opts.source,
    seconds: Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000),
    kieCredits: credits,
    model: job.provider_model,
  });
  return true;
}
