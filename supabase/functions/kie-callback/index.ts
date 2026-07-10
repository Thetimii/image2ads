// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Kie.ai webhook receiver.
 *
 * Deployed with verify_jwt=false - Kie.ai is a third-party server calling
 * this URL and has no way to obtain a Supabase-signed JWT, so the platform
 * gateway would reject every callback with 401 before this code ever ran if
 * JWT verification were on (this is exactly why the previous version of
 * this function never actually resolved a single job).
 *
 * Because this endpoint is unauthenticated, it deliberately does NOT trust
 * the callback body's result data. It only uses the callback as a "wake up
 * and check now" trigger: it looks up the job by taskId, then invokes
 * check-job-status (service-role authenticated) to re-derive the real state
 * directly from Kie.ai and finalize it. That keeps a single, already-tested
 * source of truth for parsing Kie's various response shapes (legacy/veo/
 * music), the safety-filter retry, the stale-job timeout+refund, storage
 * upload, etc. - this file never duplicates that logic.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    // Kie.ai nests the real payload under `data` on every endpoint we use
    // (legacy jobs, veo, music) - fall back to the top level just in case.
    const data = body?.data ?? body;
    const taskId: string | null =
      data?.taskId ?? new URL(req.url).searchParams.get("taskId");

    if (!taskId) {
      console.error("[kie-callback] No taskId in callback payload:", JSON.stringify(body));
      return new Response("ok", { status: 200 }); // ack anyway - don't make Kie retry forever
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("task_id", taskId)
      .maybeSingle();

    if (jobErr || !job) {
      console.log(`[kie-callback] No job found for taskId ${taskId}`);
      return new Response("ok", { status: 200 });
    }

    if (job.status !== "processing") {
      // Already resolved (completed/failed), or another trigger (client
      // poll, sweep) got there first - nothing to do.
      console.log(`[kie-callback] Job ${job.id} already status=${job.status}, skipping`);
      return new Response("ok", { status: 200 });
    }

    console.log(`[kie-callback] Job ${job.id} (taskId ${taskId}) reported activity - triggering check-job-status`);

    const resp = await fetch(
      `${SUPABASE_URL}/functions/v1/check-job-status?jobId=${job.id}`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );

    console.log(`[kie-callback] check-job-status responded ${resp.status} for job ${job.id}`);

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    console.error("[kie-callback] Error processing callback:", err);
    // Always 200 so Kie.ai doesn't hammer retries - the sweep cron is the
    // backstop if this invocation genuinely failed to resolve anything.
    return new Response("ok", { status: 200 });
  }
}

Deno.serve(handler);
