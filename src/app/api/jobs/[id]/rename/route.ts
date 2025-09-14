import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customName } = await request.json();

    if (!customName || typeof customName !== "string") {
      return NextResponse.json(
        { error: "Custom name is required" },
        { status: 400 }
      );
    }

    // Check if job exists and belongs to user
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Update the job with the custom name
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        custom_name: customName.trim(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update job name" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job renamed successfully",
    });
  } catch (error) {
    console.error("Rename error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
