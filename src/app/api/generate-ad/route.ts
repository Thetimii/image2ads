import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createJobSchema } from "@/lib/validations";
import { createJob, getUserProfile } from "@/lib/database";
import { billableCredits, parseOpenAIModel } from "@/lib/credits";

export async function POST(request: NextRequest) {
  console.log('[API] /api/generate-ad called')
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    // 1) Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Body + Validation
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { imageIds = [], prompt, aspectRatio, jobName, folderId, style = "photorealistic" } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Convert aspect ratio to model format (using medium quality)
    let model = 'openai-medium-square'; // default
    switch (aspectRatio) {
      case 'portrait':
        model = 'openai-medium-portrait';
        break;
      case 'landscape':
        model = 'openai-medium-landscape';
        break;
      case 'square':
      default:
        model = 'openai-medium-square';
        break;
    }

    // Debug logging
    console.log("Chat Generate API received:", {
      imageIds,
      prompt,
      aspectRatio,
      model,
      jobName,
      folderId
    });

    // 3) Compute credits
    const modelData = parseOpenAIModel(model);
    const actualQuality = modelData?.quality;
    const actualSize = modelData?.size;
    const credits_used = billableCredits(model, actualQuality, actualSize, 1);

    // 4) Profile & credit check
    const profile = await getUserProfile(user.id);

    console.log("Credit check:", {
      userId: user.id,
      profile: profile ? { credits: profile.credits, id: profile.id } : null,
      credits_used,
      hasEnoughCredits: profile ? profile.credits >= credits_used : false
    });

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check limits for Free users
    const isPro = profile.subscription_status === 'active' || profile.subscription_status === 'trialing';
    let dailyCount = 0;

    if (!isPro) {
      // 1. Throttle
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Daily Limit
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { count: daily, error: dailyError } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", oneDayAgo.toISOString());

      dailyCount = daily || 0;

      if (dailyCount >= 10) {
        return NextResponse.json(
          {
            error: "Daily free limit reached (10 images/day). Upgrade to Pro for unlimited generation.",
            code: "DAILY_LIMIT_REACHED",
          },
          { status: 429 }
        );
      }

      // 3. Total Limit
      const { count: total, error: totalError } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (total !== null && total >= 400) {
        return NextResponse.json(
          {
            error: "Total free limit reached (400 images). Upgrade to Pro to continue.",
            code: "TOTAL_LIMIT_REACHED",
          },
          { status: 429 }
        );
      }
    }

    if (profile.credits < credits_used) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          available: profile.credits,
          required: credits_used,
        },
        { status: 402 }
      );
    }

    // 5) Verify images belong to user (if any provided)
    if (imageIds.length > 0) {
      const { data: images, error: imagesError } = await supabase
        .from("images")
        .select("id, folder_id, user_id")
        .in("id", imageIds)
        .eq("user_id", user.id);

      if (imagesError || !images || images.length !== imageIds.length) {
        return NextResponse.json(
          { error: "One or more images not found or not owned by user" },
          { status: 404 }
        );
      }
    }

    // 6) Create job (works with or without images)
    const job = await createJob({
      userId: user.id,
      imageIds: imageIds,
      prompt: prompt.trim(),
      model: model,
      creditsUsed: credits_used,
      customName: jobName || `Generated ${new Date().toLocaleString()}`,
      stylePreset: style,
    });

    console.log("Chat job created:", {
      id: job?.id,
      model: job?.model,
      custom_name: job?.custom_name,
      has_images: imageIds.length > 0
    });

    if (!job) {
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    // 7) Fire the edge function (best-effort)
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-job`;

    console.log('Triggering edge function:', {
      url: edgeFunctionUrl,
      jobId: job.id,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    const edgeResponse = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    });

    console.log('Edge function response:', edgeResponse.status, edgeResponse.statusText);

    if (!edgeResponse.ok) {
      const errorText = await edgeResponse.text();
      console.error('Edge function error:', errorText);
      throw new Error(`Edge function failed: ${errorText}`);
    }

    const edgeResult = await edgeResponse.json();
    console.log('Edge function result:', edgeResult);

    if (edgeResult.success && edgeResult.result_path) {
      // Return success with result path for immediate redirect
      return NextResponse.json({
        success: true,
        jobId: job.id,
        result_path: edgeResult.result_path,
        usage: {
          daily_count: !isPro ? (dailyCount || 0) + 1 : 0,
          is_free_user: !isPro
        }
      }, { status: 200 });
    } else {
      throw new Error(edgeResult.error || 'Generation failed');
    }
  } catch (error) {
    console.error("Chat generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}