import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createJobSchema } from "@/lib/validations";
import { createJob, getUserProfile } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createJobSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { image_ids, prompt, credits_used } = validation.data;

    // Check if user has enough credits
    const profile = await getUserProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
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

    // Verify all images exist and belong to user
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("id, folder_id, user_id")
      .in("id", image_ids)
      .eq("user_id", user.id);

    if (imagesError || !images || images.length !== image_ids.length) {
      return NextResponse.json(
        { error: "One or more images not found" },
        { status: 404 }
      );
    }

    // Create job
    const job = await createJob({
      userId: user.id,
      imageIds: image_ids,
      prompt: prompt,
      creditsUsed: credits_used,
    });

    if (!job) {
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    // Trigger the edge function to process the job
    try {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-job`;

      await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      });
    } catch (edgeError) {
      console.error("Failed to trigger edge function:", edgeError);
      // Job is still created, but we'll note the processing error
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("Job generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
