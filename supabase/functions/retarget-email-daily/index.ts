// Daily retarget email function
// Sends 50% off Pro offer via Brevo to high-intent users
// Runs once per day at 02:00 UTC via cron

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
}

interface BrevoEmailPayload {
  sender: {
    name: string;
    email: string;
  };
  to: Array<{
    email: string;
    name: string;
  }>;
  subject: string;
  htmlContent: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Brevo API key
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY environment variable not set");
    }

    console.log("Starting daily retarget email campaign...");

    // Query eligible users
    const { data: users, error: queryError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("tutorial_completed", true)
      .eq("credits", 0)
      .is("subscription_id", null)
      .or("email_retarget_sent.is.false,email_retarget_sent.is.null");

    if (queryError) {
      console.error("Error querying users:", queryError);
      throw queryError;
    }

    if (!users || users.length === 0) {
      console.log("No eligible users found for retargeting");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible users to email",
          sent: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Found ${users.length} eligible users for retargeting`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process each user
    for (const user of users as User[]) {
      try {
        const firstName = user.full_name?.split(" ")[0] || "creator";

        // Build email HTML content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Image2Ad Pro</h1>
  </div>
  
  <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 18px; margin-bottom: 20px;">Hey ${firstName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      You were just creating some amazing ads with <strong>Image2Ad</strong> 👀
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Here's a surprise while your creativity's still hot – <strong style="color: #FF5B7E;">50% off your first month of Pro</strong>!
    </p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="font-size: 16px; margin-bottom: 15px;">
        🎁 Use code <strong style="font-size: 20px; color: #FF5B7E;">FIRST50</strong> at checkout to unlock:
      </p>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>200 credits</strong> per month</li>
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>HD image & video generation</strong></li>
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Full commercial use</strong></li>
        <li style="padding: 8px 0; font-size: 15px;">✅ <strong>Priority support</strong></li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="https://www.image2ad.com/pricing?coupon=first50" style="background: #FF5B7E; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(255,91,126,0.3);">
        Activate My 50% Off 🚀
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 30px; border-top: 1px solid #eee;">
      <strong>Offer valid for 24 hours.</strong><br>
      This is a one-time exclusive offer for early creators like you.
    </p>
    
    <p style="font-size: 16px; margin-top: 30px;">
      Keep creating,<br>
      <strong>— Tim from Image2Ad</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>Image2Ad - Turn Your Ideas into Ads</p>
    <p>
      <a href="https://www.image2ad.com" style="color: #999; text-decoration: none;">www.image2ad.com</a>
    </p>
  </div>
</body>
</html>`;

        const emailPayload: BrevoEmailPayload = {
          sender: {
            name: "Tim from Image2Ad",
            email: "hello@image2ad.com",
          },
          to: [
            {
              email: user.email,
              name: user.full_name || "creator",
            },
          ],
          subject: "Your Image2Ad Pro Early Access – 50% Off 🎁",
          htmlContent: htmlContent,
        };

        // Send email via Brevo
        const brevoResponse = await fetch(
          "https://api.brevo.com/v3/smtp/email",
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "api-key": brevoApiKey,
              "content-type": "application/json",
            },
            body: JSON.stringify(emailPayload),
          }
        );

        if (!brevoResponse.ok) {
          const errorText = await brevoResponse.text();
          throw new Error(
            `Brevo API error: ${brevoResponse.status} - ${errorText}`
          );
        }

        console.log(`Email sent successfully to ${user.email}`);

        // Mark email as sent in database
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ email_retarget_sent: true })
          .eq("id", user.id);

        if (updateError) {
          console.error(
            `Error updating email_retarget_sent for user ${user.id}:`,
            updateError
          );
          // Don't throw here - email was sent successfully
        }

        successCount++;

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        errorCount++;
        errors.push({
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(
      `Campaign complete: ${successCount} sent, ${errorCount} errors`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Retarget email campaign completed",
        totalUsers: users.length,
        sent: successCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Fatal error in retarget email function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
