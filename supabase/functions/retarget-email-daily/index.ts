// Daily retarget email sequence.
// Sends up to 3 emails to signed-up, non-subscribed users - day 1 (tips),
// day 3 (feature highlight), day 7 (50% off close) - each exactly once,
// tracked independently in retarget_email_log so nobody gets a step twice
// and nobody gets the same message repeated.
// Runs once per day via cron (see Supabase Dashboard > Cron Jobs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface User {
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

const STEPS: Step[] = [
  {
    key: "day1",
    minAgeDays: 1,
    maxAgeDays: 14,
    subject: "3 quick tips to get better ads out of Image2Ad 🎨",
    body: (firstName) => `
      <p style="font-size: 18px; margin-bottom: 20px;">Hey ${firstName},</p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        You signed up for <strong>Image2Ad</strong> yesterday - here are 3 quick things that make a big difference in the ads you get out of it:
      </p>
      <ul style="font-size: 15px; padding-left: 20px; margin-bottom: 20px;">
        <li style="margin-bottom: 12px;"><strong>Be specific in your prompt.</strong> "Product on a marble countertop with soft morning light" beats "nice background" every time.</li>
        <li style="margin-bottom: 12px;"><strong>Upload a clean reference photo.</strong> Good lighting and a plain background on your source image = a much better generated result.</li>
        <li style="margin-bottom: 12px;"><strong>Try nano-banana-pro for your best product.</strong> Higher resolution and sharper detail than the standard model - worth it for your hero shots.</li>
      </ul>
      <div style="text-align: center; margin: 40px 0;">
        <a href="https://www.image2ad.com/dashboard" style="background: #FF5B7E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600; display: inline-block;">
          Create Another Ad →
        </a>
      </div>
      <p style="font-size: 16px; margin-top: 30px;">Keep creating,<br><strong>— Tim from Image2Ad</strong></p>
    `,
  },
  {
    key: "day3",
    minAgeDays: 3,
    maxAgeDays: 17,
    subject: "What Pro creators do differently on Image2Ad",
    body: (firstName) => `
      <p style="font-size: 18px; margin-bottom: 20px;">Hey ${firstName},</p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        A few things Pro users lean on that free accounts don't get to touch yet:
      </p>
      <ul style="list-style: none; padding: 0; margin: 0 0 20px 0;">
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Video &amp; music generation</strong> - turn a still product shot into a moving ad</li>
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>200 credits every month</strong> instead of spending down a one-time free batch</li>
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Full commercial usage rights</strong> on everything you generate</li>
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Priority generation</strong> - your jobs don't sit behind free-tier traffic</li>
      </ul>
      <div style="text-align: center; margin: 40px 0;">
        <a href="https://www.image2ad.com/billing" style="background: #FF5B7E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600; display: inline-block;">
          See Pro Plans →
        </a>
      </div>
      <p style="font-size: 16px; margin-top: 30px;">Keep creating,<br><strong>— Tim from Image2Ad</strong></p>
    `,
  },
  {
    key: "day7",
    minAgeDays: 7,
    maxAgeDays: 21,
    subject: "Your Image2Ad Pro Early Access – 50% Off 🎁",
    body: (firstName) => `
      <p style="font-size: 18px; margin-bottom: 20px;">Hey ${firstName},</p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        Thanks for trying out <strong>Image2Ad</strong> this past week 👀
      </p>
      <p style="font-size: 16px; margin-bottom: 20px;">
        Here's a surprise while your creativity's still hot – <strong style="color: #FF5B7E;">50% off your first month of Pro</strong>!
      </p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="font-size: 16px; margin-bottom: 15px;">
          🎁 Click the button below to unlock it automatically - no code needed:
        </p>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="padding: 8px 0; font-size: 15px;">✅ <strong>200 credits</strong> per month</li>
          <li style="padding: 8px 0; font-size: 15px;">✅ <strong>HD image &amp; video generation</strong></li>
          <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Full commercial use</strong></li>
          <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Priority support</strong></li>
        </ul>
      </div>
      <div style="text-align: center; margin: 40px 0;">
        <a href="https://www.image2ad.com/billing?promo=pro20limited" style="background: #FF5B7E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(255,91,126,0.3);">
          Activate My 50% Off 🚀
        </a>
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 30px; border-top: 1px solid #eee;">
        <strong>Offer valid for 1 hour after you click.</strong><br>
        This is a one-time exclusive offer for early creators like you.
      </p>
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

    const results: Record<string, { sent: number; errors: number }> = {};

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
        results[step.key] = { sent: 0, errors: 1 };
        continue;
      }

      if (!candidates || candidates.length === 0) {
        results[step.key] = { sent: 0, errors: 0 };
        continue;
      }

      // Filter out anyone already sent this specific step
      const { data: alreadySent } = await supabase
        .from("retarget_email_log")
        .select("user_id")
        .eq("step", step.key)
        .in("user_id", candidates.map((c) => c.id));

      const alreadySentIds = new Set((alreadySent || []).map((r) => r.user_id));
      const eligible = (candidates as User[]).filter((c) => !alreadySentIds.has(c.id));

      let sent = 0;
      let errors = 0;

      for (const user of eligible) {
        try {
          const firstName = user.full_name?.split(" ")[0] || "creator";
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
              to: [{ email: user.email, name: user.full_name || "creator" }],
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
            .insert({ user_id: user.id, step: step.key });

          if (logError) {
            console.error(`Error logging ${step.key} for user ${user.id}:`, logError);
          }

          sent++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error sending ${step.key} to user ${user.id}:`, error);
          errors++;
        }
      }

      console.log(`Step ${step.key}: ${sent} sent, ${errors} errors`);
      results[step.key] = { sent, errors };
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
