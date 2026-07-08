// Zero-activation win-back sequence: 2 emails to signed-up users who have
// never completed a single generation - day 1 (nudge back to the upload
// wizard) and day 3 (second nudge, different angle) - each sent exactly
// once, tracked in retarget_email_log so nobody gets a step twice.
//
// Consolidates what used to be two separate, uncoordinated systems:
// - the old /api/cron/send-reminders route (gated on time-since-first-job,
//   so it only ever reached users who had ALREADY generated - the opposite
//   of the activation problem - and its 15-minute-window step could never
//   realistically fire against a once-daily cron) - retired.
// - this function's old 3-step day1/day3/day7 sequence, which fired at
//   every non-subscribed user regardless of whether they'd ever activated,
//   and pitched Pro features at people who hadn't even tried a free
//   generation yet - narrowed here to the zero-activation cohort only.
//
// Triggered daily by /api/cron/retarget-email (see vercel.json), not a
// Supabase Dashboard cron - the trigger itself is now version-controlled.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Candidate {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

function wrapEmail(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Image2Ad</h1>
  </div>
  <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    ${bodyHtml}
  </div>
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>Image2Ad - Turn Your Ideas into Ads</p>
    <p><a href="https://www.image2ad.com" style="color: #999; text-decoration: none;">www.image2ad.com</a></p>
  </div>
</body>
</html>`;
}

interface Step {
  key: string; // matches retarget_email_log.step
  minAgeDays: number; // eligible once account is at least this old
  maxAgeDays: number; // safety cap so old dormant accounts don't get blasted the first time this runs
  subject: string;
  body: (firstName: string) => string;
}

// Both steps link straight to /dashboard rather than a special query param:
// anyone in this zero-activation cohort still has tutorial_completed=false
// (it's only set on skip or on an actual completed generation), so
// /dashboard's normal redirect already lands them on the upload wizard.
const STEPS: Step[] = [
  {
    key: "day1",
    minAgeDays: 1,
    maxAgeDays: 14,
    subject: "Your first ad is 1 tap away 📸",
    body: (firstName) => `
      <p style="font-size: 18px; margin-bottom: 20px;">Hey ${firstName},</p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        You signed up for <strong>Image2Ad</strong> yesterday but haven't made your first ad yet - it takes about 15 seconds once you've got a photo.
      </p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        No photo handy? You can try it right now with one of our sample products - no upload needed.
      </p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="https://www.image2ad.com/dashboard" style="background: #FF5B7E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600; display: inline-block;">
          Make My First Ad →
        </a>
      </div>
      <p style="font-size: 16px; margin-top: 30px;">Keep creating,<br><strong>— Tim from Image2Ad</strong></p>
    `,
  },
  {
    key: "day3",
    minAgeDays: 3,
    maxAgeDays: 17,
    subject: "Still haven't tried Image2Ad? Here's the fastest way in",
    body: (firstName) => `
      <p style="font-size: 18px; margin-bottom: 20px;">Hey ${firstName},</p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        A few days in and you haven't generated your first ad yet - totally fine, here's the fastest path if you got stuck:
      </p>
      <ul style="font-size: 15px; padding-left: 20px; margin-bottom: 20px;">
        <li style="margin-bottom: 12px;">Tap <strong>Upload your product photo</strong> - your phone's camera roll opens automatically.</li>
        <li style="margin-bottom: 12px;">No product photo ready? Tap one of the <strong>sample products</strong> instead - same result, zero upload.</li>
        <li style="margin-bottom: 12px;">That's it. No prompt to write - we generate the first version for you automatically.</li>
      </ul>
      <div style="text-align: center; margin: 40px 0;">
        <a href="https://www.image2ad.com/dashboard" style="background: #FF5B7E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600; display: inline-block;">
          Try It Now →
        </a>
      </div>
      <p style="font-size: 16px; margin-top: 30px;">Keep creating,<br><strong>— Tim from Image2Ad</strong></p>
    `,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY environment variable not set");
    }

    const results: Record<string, { sent: number; errors: number; skipped_activated: number }> = {};

    for (const step of STEPS) {
      console.log(`Processing retarget step: ${step.key}`);

      const minAge = new Date(Date.now() - step.minAgeDays * 24 * 60 * 60 * 1000).toISOString();
      const maxAge = new Date(Date.now() - step.maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

      // Users old enough for this step, not too old (safety cap), never subscribed
      const { data: candidates, error: queryError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .lte("created_at", minAge)
        .gte("created_at", maxAge)
        .is("subscription_id", null);

      if (queryError) {
        console.error(`Error querying candidates for ${step.key}:`, queryError);
        results[step.key] = { sent: 0, errors: 1, skipped_activated: 0 };
        continue;
      }

      if (!candidates || candidates.length === 0) {
        results[step.key] = { sent: 0, errors: 0, skipped_activated: 0 };
        continue;
      }

      // Zero-activation gate: exclude anyone with at least one completed
      // job. Deliberately NOT using profiles.total_generations - that
      // column increments on job INSERT (i.e. attempts), not on success,
      // so it can't distinguish "never tried" from "tried and failed".
      const { data: completedJobs } = await supabase
        .from("jobs")
        .select("user_id")
        .eq("status", "completed")
        .in("user_id", candidates.map((c) => c.id));

      const activatedIds = new Set((completedJobs || []).map((j) => j.user_id));

      // Filter out anyone already sent this specific step
      const { data: alreadySent } = await supabase
        .from("retarget_email_log")
        .select("user_id")
        .eq("step", step.key)
        .in("user_id", candidates.map((c) => c.id));

      const alreadySentIds = new Set((alreadySent || []).map((r) => r.user_id));

      const skippedActivated = candidates.filter((c) => activatedIds.has(c.id) && !alreadySentIds.has(c.id)).length;
      const eligible = (candidates as Candidate[]).filter(
        (c) => !alreadySentIds.has(c.id) && !activatedIds.has(c.id)
      );

      let sent = 0;
      let errors = 0;

      for (const candidate of eligible) {
        try {
          const firstName = candidate.full_name?.split(" ")[0] || "creator";
          const htmlContent = wrapEmail(step.body(firstName));

          const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              accept: "application/json",
              "api-key": brevoApiKey,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Tim from Image2Ad", email: "hello@image2ad.com" },
              to: [{ email: candidate.email, name: candidate.full_name || "creator" }],
              subject: step.subject,
              htmlContent,
            }),
          });

          if (!brevoResponse.ok) {
            const errorText = await brevoResponse.text();
            throw new Error(`Brevo API error: ${brevoResponse.status} - ${errorText}`);
          }

          const { error: logError } = await supabase
            .from("retarget_email_log")
            .insert({ user_id: candidate.id, step: step.key });

          if (logError) {
            console.error(`Error logging ${step.key} for user ${candidate.id}:`, logError);
          }

          sent++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error sending ${step.key} to user ${candidate.id}:`, error);
          errors++;
        }
      }

      console.log(`Step ${step.key}: ${sent} sent, ${errors} errors, ${skippedActivated} skipped (already activated)`);
      results[step.key] = { sent, errors, skipped_activated: skippedActivated };
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Fatal error in retarget email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
