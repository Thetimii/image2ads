/**
 * GET ?jobId=...  ->  { success, status, result_url, cover_url, error, error_message }
 *
 * Browser poll + internal re-check. kie.ai callbacks normally finish jobs
 * within seconds, so this is usually a plain DB read; it only asks kie.ai
 * itself when the job hasn't been checked for RECHECK_MS (protects the kie.ai
 * rate limit from many open tabs polling every few seconds).
 */
import { authorizeJob } from "../_shared/auth.ts";
import { corsHeaders, json, logError } from "../_shared/http.ts";
import { isTerminal, loadJob, syncJob, type JobRow } from "../_shared/pipeline.ts";

const RECHECK_MS = 10_000;

function view(job: JobRow) {
  const failed = job.status === "failed";
  return {
    success: !failed,
    jobId: job.id,
    status: job.status,
    result_type: job.result_type,
    result_url: job.status === "completed" ? job.result_url : null,
    cover_url: job.status === "completed" ? job.cover_url : null,
    error: failed ? job.error_message ?? "Generation failed" : null,
    error_message: failed ? job.error_message ?? "Generation failed" : null,
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req, "GET, OPTIONS");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ success: false, error: "Method not allowed" }, 405, cors);

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return json({ success: false, error: "jobId required" }, 400, cors);

  try {
    const job = await loadJob(jobId);
    if (!job) return json({ success: false, error: "Job not found" }, 404, cors);

    const auth = await authorizeJob(req, job.user_id);
    if (!auth.ok) return json({ success: false, error: auth.message }, auth.status, cors);

    if (isTerminal(job.status)) return json(view(job), 200, cors);

    const synced = await syncJob(jobId, { source: "poll", minRecheckMs: RECHECK_MS });
    return json(view(synced ?? job), 200, cors);
  } catch (err) {
    logError("check-job-status", "unhandled", err, { jobId });
    // Transient - the client keeps polling; nothing is marked failed here.
    return json({ success: true, jobId, status: "processing", error: null }, 200, cors);
  }
});
