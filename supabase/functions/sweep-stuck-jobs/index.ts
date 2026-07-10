// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Server-side safety net for the generation pipeline.
 *
 * Job completion used to depend entirely on either the Kie.ai webhook (which
 * never actually fired - see kie-callback) or the browser tab staying open
 * and polling check-job-status. If a user closed the tab, nothing ever
 * revisited the job again; some sat in status='processing' for days.
 *
 * This function is invoked on a schedule (see the pg_cron job created
 * alongside it) completely independent of any client or webhook, and:
 *
 *  1. Fails (without refunding) jobs that never even got a task_id - either
 *     still status='pending' (the client inserted the job row but the
 *     fetch() to the generate-* edge function never landed - tab closed,
 *     network drop, etc.) or status='processing' with task_id still null
 *     (the generate-* function died between consuming the credit and
 *     creating the Kie.ai task). Neither can ever resolve on its own.
 *     Refund is intentionally skipped for both: a 'pending' job never
 *     reached consume_credit at all (that only runs after the
 *     pending->processing transition, inside the generate-* function), and
 *     credits_used defaults to 1 in the schema for every job regardless of
 *     whether it went through a credit-consuming path or a free-tier path
 *     (which explicitly zeroes it out on its own "processing" update), so
 *     for the processing-but-no-task_id case we can't yet reliably tell
 *     which we're in either - safer to under-refund than to mint free
 *     credits.
 *  2. Re-triggers check-job-status for any job that has a task_id and has
 *     gone quiet for 90+ seconds - the same battle-tested logic the client
 *     poll and the webhook both call, so a genuinely finished job gets its
 *     real result, and a genuinely dead one hits check-job-status's own
 *     5/10-minute timeout -> fail -> refund path (unchanged, pre-existing
 *     behavior - this function does not duplicate that decision).
 *
 * Deployed with verify_jwt=false since pg_cron calls it with no user
 * session. It's safe to be public: it takes no meaningful input, only acts
 * on jobs that are already stale by wall-clock time in the database, and
 * every mutation it makes is idempotent.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_LIMIT = 25;

async function handler(req: Request) {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const summary = {
    orphaned_failed: 0,
    stale_triggered: 0,
    trigger_errors: [] as string[],
  };

  try {
    // 1) Orphaned jobs: stuck in "pending" (never reached the generate-*
    // edge function at all) or "processing" with no task_id (died before
    // the Kie.ai task was created), old enough that we know it's not just
    // still in flight.
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: orphaned, error: orphanedErr } = await supabase
      .from("jobs")
      .select("id, status")
      .or(`status.eq.pending,and(status.eq.processing,task_id.is.null)`)
      .lt("created_at", threeMinAgo)
      .limit(BATCH_LIMIT);

    if (orphanedErr) throw orphanedErr;

    for (const job of orphaned ?? []) {
      const { error: updErr } = await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Generation failed to start. Please try again.",
          failure_category: "unknown",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", job.status); // no-op if something else already resolved it
      if (!updErr) summary.orphaned_failed++;
    }

    // 2) Stale jobs with a task_id: re-check them via check-job-status.
    const ninetySecAgo = new Date(Date.now() - 90 * 1000).toISOString();
    const { data: stale, error: staleErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("status", "processing")
      .not("task_id", "is", null)
      .lt("updated_at", ninetySecAgo)
      .limit(BATCH_LIMIT);

    if (staleErr) throw staleErr;

    const outcomes = await Promise.allSettled(
      (stale ?? []).map((job) =>
        fetch(`${SUPABASE_URL}/functions/v1/check-job-status?jobId=${job.id}`, {
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        }).then((resp) => ({ id: job.id, status: resp.status }))
      )
    );

    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        summary.stale_triggered++;
        if (!outcome.value.status || outcome.value.status >= 400) {
          summary.trigger_errors.push(`job ${outcome.value.id}: check-job-status ${outcome.value.status}`);
        }
      } else {
        summary.trigger_errors.push(String(outcome.reason));
      }
    }

    console.log("[sweep-stuck-jobs] Summary:", JSON.stringify(summary));

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[sweep-stuck-jobs] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message ?? err), ...summary }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
