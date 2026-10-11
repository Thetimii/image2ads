/**
 * kie.ai webhook receiver (deployed with verify_jwt = false).
 *
 * 1. Authenticate: kie.ai's HMAC headers (if KIE_WEBHOOK_HMAC_KEY is set) OR
 *    our per-job ?job=&sig= token from the callBackUrl. Unauthenticated
 *    requests get 401 and do nothing.
 * 2. Ack with 200 immediately (kie.ai times out callbacks after 15s, and a
 *    video download + upload can take longer).
 * 3. In the background (EdgeRuntime.waitUntil) run syncJob(), which re-reads
 *    the task from kie.ai and completes / fails / refunds. The callback body
 *    is never trusted for results. If kie.ai's record still lags behind the
 *    callback, re-check a few times with backoff.
 */
import { corsHeaders, json, log, logError } from "../_shared/http.ts";
import { db, isTerminal, syncJob } from "../_shared/pipeline.ts";
import { verifyJobCallbackToken, verifyKieSignature } from "../_shared/signing.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const RECHECK_DELAYS_MS = [0, 3_000, 8_000, 20_000];

function background(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
  else p.catch(() => {});
}

async function resolve(jobId: string, taskId: string | null) {
  for (const delay of RECHECK_DELAYS_MS) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const job = await syncJob(jobId, { source: "callback" });
      if (!job || isTerminal(job.status)) {
        log("kie-callback", "resolved", { jobId, taskId, status: job?.status });
        return;
      }
      // A newer task (safety retry) replaced the one this callback is about.
      if (taskId && job.task_id && job.task_id !== taskId) return;
    } catch (err) {
      logError("kie-callback", "sync_failed", err, { jobId, taskId });
    }
  }
  log("kie-callback", "still_running", { jobId, taskId }); // e.g. Suno "first" stage - the "complete" callback follows
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req, "POST, OPTIONS");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  const taskId = typeof data.taskId === "string" ? data.taskId : typeof data.task_id === "string" ? data.task_id : url.searchParams.get("taskId");
  const urlJobId = url.searchParams.get("job");

  const hmacKey = Deno.env.get("KIE_WEBHOOK_HMAC_KEY") ?? "";
  const kieSigned = !!hmacKey && !!taskId &&
    await verifyKieSignature(taskId, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature"), hmacKey);
  const tokenOk = await verifyJobCallbackToken(urlJobId, url.searchParams.get("sig"), Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "");

  if (!kieSigned && !tokenOk) {
    log("kie-callback", "rejected", { taskId, urlJobId, hasKieHeaders: !!req.headers.get("x-webhook-signature") });
    return json({ error: "invalid signature" }, 401, cors);
  }

  // Find the job: by the signed job id when present, else by task id.
  let jobId: string | null = tokenOk ? urlJobId : null;
  if (!jobId && taskId) {
    const { data: row } = await db().from("jobs").select("id").eq("task_id", taskId).maybeSingle();
    jobId = (row as { id: string } | null)?.id ?? null;
  }
  if (!jobId) {
    log("kie-callback", "unknown_task", { taskId });
    return json({ ok: true }, 200, cors);
  }

  log("kie-callback", "received", { jobId, taskId, code: body.code, callbackType: data.callbackType ?? null, state: data.state ?? null });
  background(resolve(jobId, taskId));
  return json({ ok: true }, 200, cors);
});
