/**
 * Last-resort backstop. Not on a timer: public.sweep_stuck_jobs() (pg_cron,
 * every 5 min, pure SQL) only calls this when a processing job has gone quiet,
 * so an idle system costs zero invocations.
 *
 * Runs syncJob() in-process for each stale job (no HTTP hop to
 * check-job-status). Safe to be reachable without auth: it takes no input,
 * only touches jobs that are already stale, every transition is idempotent,
 * and each job is re-checked against kie.ai at most once a minute however
 * often this is called. A wrong x-internal-secret is still rejected.
 */
import { json, log, logError } from "../_shared/http.ts";
import { db, syncJob } from "../_shared/pipeline.ts";
import { timingSafeEqual } from "../_shared/signing.ts";

const BATCH_LIMIT = 25;
const CONCURRENCY = 5;
const STALE_AFTER_MS = 2 * 60_000;
const MIN_RECHECK_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const presented = req.headers.get("x-internal-secret");
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
  if (presented && !(secret && timingSafeEqual(presented, secret))) return json({ error: "unauthorized" }, 401);

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data, error } = await db()
    .from("jobs")
    .select("id")
    .in("status", ["pending", "processing"])
    .lt("updated_at", staleBefore)
    .order("updated_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) {
    logError("sweep-stuck-jobs", "query_failed", error);
    return json({ ok: false, error: error.message }, 500);
  }

  const ids = (data ?? []).map((r: { id: string }) => r.id);
  const outcome: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(ids.slice(i, i + CONCURRENCY).map((id) => syncJob(id, { source: "sweep", minRecheckMs: MIN_RECHECK_MS })));
    for (const r of results) {
      const k = r.status === "fulfilled" ? r.value?.status ?? "missing" : "error";
      outcome[k] = (outcome[k] ?? 0) + 1;
    }
  }
  log("sweep-stuck-jobs", "done", { checked: ids.length, outcome });
  return json({ ok: true, checked: ids.length, outcome });
});
