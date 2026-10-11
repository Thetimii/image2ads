// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * On-demand re-check for generation jobs that have gone quiet.
 *
 * How job completion works now (in order of preference):
 *
 *  1. Kie.ai webhook -> kie-callback -> check-job-status. This is the
 *     primary, event-driven path and resolves the vast majority of jobs
 *     within seconds of Kie finishing.
 *  2. The browser polls check-job-status while the tab is open.
 *  3. This function, as a last-resort backstop for jobs that neither of
 *     the above resolved (webhook lost, tab closed, transient error).
 *
 * This function is NOT called on a fixed schedule any more. The pg_cron job
 * runs a pure-SQL function (public.sweep_stuck_jobs) every few minutes that
 *   - fails orphaned jobs (no task_id) directly in SQL, and
 *   - calls THIS function via pg_net ONLY when at least one processing job
 *     with a task_id has gone quiet.
 * On an idle day that means zero edge-function invocations and zero API
 * gateway requests, instead of the ~7,000/day the old every-minute HTTP
 * cron produced.
 *
 * Deployed with verify_jwt=false (pg_net has no user session). Safe to be
 * public: it takes no meaningful input, only acts on jobs that are already
 * stale by wall-clock time, and every mutation is idempotent (check-job-status
 * itself is what decides to complete / fail / refund).
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_LIMIT = 25;
const STALE_AFTER_MS = 2 * 60 * 1000;

async function handler(req: Request) {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const summary = { stale_found: 0, stale_triggered: 0, trigger_errors: [] as string[] };

  try {
    if (!INTERNAL_SECRET) {
      throw new Error("INTERNAL_FUNCTION_SECRET not set - cannot call check-job-status");
    }

    const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    const { data: stale, error: staleErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("status", "processing")
      .not("task_id", "is", null)
      .lt("updated_at", staleBefore)
      .order("updated_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (staleErr) throw staleErr;
    summary.stale_found = stale?.length ?? 0;

    const outcomes = await Promise.allSettled(
      (stale ?? []).map((job) =>
        fetch(`${SUPABASE_URL}/functions/v1/check-job-status?jobId=${job.id}`, {
          // check-job-status authorizes internal callers via x-internal-secret
          // (utils/auth.ts). A service-role Bearer token is rejected with 401.
          headers: { "x-internal-secret": INTERNAL_SECRET },
        }).then((resp) => ({ id: job.id, status: resp.status }))
      )
    );

    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        summary.stale_triggered++;
        if (outcome.value.status >= 400) {
          summary.trigger_errors.push(`job ${outcome.value.id}: check-job-status ${outcome.value.status}`);
        }
      } else {
        summary.trigger_errors.push(String(outcome.reason));
      }
    }

    console.log("[sweep-stuck-jobs] Summary:", JSON.stringify(summary));
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[sweep-stuck-jobs] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err), ...summary }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
