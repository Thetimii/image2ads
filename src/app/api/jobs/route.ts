import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserJobs, getSignedUrl } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folder_id");

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user jobs, optionally filtered by folder
    let jobs;
    if (folderId) {
      // Filter jobs by folder - get jobs where any of the image_ids belong to the specified folder
      const { data: folderImages } = await supabase
        .from("images")
        .select("id")
        .eq("folder_id", folderId)
        .eq("user_id", user.id);

      if (folderImages && folderImages.length > 0) {
        const imageIds = folderImages.map((img) => img.id);

        // Get jobs where image_ids array overlaps with folder's image IDs
        const { data: folderJobs } = await supabase
          .from("jobs")
          .select("*")
          .eq("user_id", user.id)
          .or(imageIds.map((id) => `image_ids.cs.{${id}}`).join(","));

        jobs = folderJobs || [];
      } else {
        jobs = [];
      }
    } else {
      jobs = await getUserJobs(user.id);
    }

    // Enhance jobs with signed URLs for completed results
    const enhancedJobs = await Promise.all(
      jobs.map(async (job) => {
        if (job.status === "completed" && job.result_url) {
          const signedUrl = await getSignedUrl("results", job.result_url, 300); // 5 minutes
          return {
            ...job,
            result_signed_url: signedUrl,
          };
        }
        return job;
      })
    );

    return NextResponse.json({ jobs: enhancedJobs });
  } catch (error) {
    console.error("Jobs fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
