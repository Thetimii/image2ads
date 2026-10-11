import { authorizeJob } from "./auth.ts";
import { corsHeaders, json, logError } from "./http.ts";
import { failJob, loadJob, startGeneration } from "./pipeline.ts";

/**
 * POST { jobId, model?: "nano-banana" | "nano-banana-pro", resolution?: "1K" | "2K" | "4K" }
 *
 * The job row (created by the browser, status 'pending') decides what is
 * generated: result_type image/video/music, has_images, aspect_ratio,
 * music_options. Pricing and free-tier rules are decided here, never by the
 * client.
 */
export async function handleGenerate(req: Request): Promise<Response> {
  const cors = corsHeaders(req, "POST, OPTIONS");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405, cors);

  let jobId: string | null = null;
  let authorized = false;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    jobId = typeof body.jobId === "string" ? body.jobId : null;
    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return json({ success: false, error: "jobId required", code: "BAD_REQUEST" }, 400, cors);

    const job = await loadJob(jobId);
    if (!job) return json({ success: false, error: "Job not found", code: "NOT_FOUND" }, 404, cors);

    const auth = await authorizeJob(req, job.user_id);
    if (!auth.ok) return json({ success: false, error: auth.message, code: "UNAUTHORIZED" }, auth.status, cors);
    authorized = true;

    const result = await startGeneration(job, {
      model: typeof body.model === "string" ? body.model : null,
      resolution: typeof body.resolution === "string" ? body.resolution : null,
    });
    return json(result.body, result.http, cors);
  } catch (err) {
    logError("generate", "unhandled", err, { jobId });
    // Refund right away if no kie.ai task exists yet (otherwise the task is
    // live and the callback / sweep will resolve it).
    if (jobId && authorized) {
      await failJob(jobId, "unknown", err instanceof Error ? err.message : String(err), undefined, {}, true).catch(() => {});
    }
    return json({ success: false, error: "Generation failed to start. Please try again.", code: "INTERNAL", jobId }, 500, cors);
  }
}
