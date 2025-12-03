import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createJobSchema } from "@/lib/validations";
import { createJob, getUserProfile } from "@/lib/database";
import { billableCredits, parseOpenAIModel } from "@/lib/credits";

export async function POST(request: NextRequest) {
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

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation failed:", parsed.error.issues);
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { image_ids, prompt, model, quality, size, n, custom_name } = parsed.data;

    // Debug logging
    console.log("Generate API received:", {
      image_ids,
      prompt,
      model,
      custom_name,
      body_keys: Object.keys(body)
    });

    // 3) Compute credits on the server (don't trust client)
    let actualQuality = quality;
    let actualSize = size;

    // For OpenAI models, extract quality and size from model name
    if (model.startsWith("openai-")) {
      const modelData = parseOpenAIModel(model);
      if (modelData) {
        actualQuality = modelData.quality;
        actualSize = modelData.size;
      }
    }

    const credits_used = billableCredits(model, actualQuality, actualSize, n);

    // 4) Profile & credit check
    const profile = await getUserProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check subscription status
    const isPro =
      profile.subscription_status === "active" ||
      profile.subscription_status === "trialing";

    // RESTRICTION: Nano Banana Pro is for Pro users only
    if (model === "nano-banana-pro" && !isPro) {
      return NextResponse.json(
        {
          error: "Nano Banana Pro is available only on paid plans",
          code: "PRO_ONLY",
        },
        { status: 403 }
      );
    }

    // LIMITS & THROTTLING for Free Users
    if (!isPro) {
      // 1. Throttle: Artificial delay of 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 2. Daily Limit: Check jobs created in the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { count, error: countError } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", oneDayAgo.toISOString());

      if (!countError && count !== null && count >= 100) {
        return NextResponse.json(
          {
            error: "Daily free limit reached (100 images/day). Upgrade to Pro for unlimited generation.",
            code: "LIMIT_REACHED",
          },
          { status: 429 }
        );
      }
    }

    // Credit check (only if cost > 0)
    if (credits_used > 0 && profile.credits < credits_used) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          available: profile.credits,
          required: credits_used,
        },
        { status: 402 }
      );
    }

    // 5) Verify images belong to user
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("id, folder_id, user_id")
      .in("id", image_ids)
      .eq("user_id", user.id);

    if (imagesError || !images || images.length !== image_ids.length) {
      return NextResponse.json(
        { error: "One or more images not found or not owned by user" },
        { status: 404 }
      );
    }

    // 6) Create job
    const job = await createJob({
      userId: user.id,
      imageIds: image_ids,
      prompt: prompt,
      model: model,
      creditsUsed: credits_used,
      customName: custom_name,
    });

    console.log("Job created:", {
      id: job?.id,
      model: job?.model,
      custom_name: job?.custom_name
    });

    if (!job) {
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    // 7) Fire the edge function (best-effort)
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-job`;

    fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((e) => console.error("Failed to trigger edge function:", e));

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("Job generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
