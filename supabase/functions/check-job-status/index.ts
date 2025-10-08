// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// --- CORS ---
const ALLOWED_ORIGINS = new Set([
  "https://image2ad.com",
  "https://www.image2ad.com", 
  "http://localhost:3000",
  "http://localhost:5173"
]);

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://image2ad.com";
  const acrh =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": acrh,
    "Access-Control-Expose-Headers": "content-type",
    "Vary": "Origin, Access-Control-Request-Headers"
  };
}

async function downloadFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// --- Main handler ---
async function handler(req: Request) {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET")
    return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    
    if (!jobId) {
      return new Response("Job ID required", { status: 400, headers: cors });
    }

    const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
    if (!KIE_API_KEY) throw new Error("KIE_API_KEY not set");

    // Get job details
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    
    if (jobErr || !job) {
      return new Response("Job not found", { status: 404, headers: cors });
    }

    // If job is already completed, return the result
    if (job.status === "completed" && job.result_url) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "completed", 
          result_url: job.result_url,
          jobId 
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // If job failed, return error
    if (job.status === "failed") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: "failed", 
          error: job.error_message || "Generation failed",
          jobId 
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check if we have a task_id to poll
    if (!job.task_id) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "processing", 
          message: "Task still initializing",
          jobId 
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Poll Kie.ai for result
    console.log(`[check-job-status] Checking task ${job.task_id} for job ${jobId}`);
    
    const response = await fetch(
      `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${job.task_id}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Kie.ai API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[check-job-status] Kie.ai response:`, result);

    // Check if the task is still processing
    if (result.data?.state !== "success") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "processing", 
          progress: result.data?.state || "queued",
          message: "Generation in progress",
          jobId 
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Task completed successfully - get the result URL
    // Parse the resultJson string that contains the URLs
    let resultUrl: string | null = null;
    
    try {
      const resultJsonStr = result.data?.resultJson;
      if (resultJsonStr) {
        const parsed = typeof resultJsonStr === 'string' ? JSON.parse(resultJsonStr) : resultJsonStr;
        resultUrl = parsed?.resultUrls?.[0];
        console.log(`[check-job-status] Parsed resultJson:`, parsed);
      }
      
      // Fallback to direct resultUrl if parsing fails
      if (!resultUrl) {
        resultUrl = result.data?.resultUrl;
      }
    } catch (parseError) {
      console.error(`[check-job-status] Failed to parse resultJson:`, parseError);
      resultUrl = result.data?.resultUrl;
    }
    
    if (!resultUrl) {
      console.error(`[check-job-status] No result URL found. Full response:`, JSON.stringify(result, null, 2));
      throw new Error("No result URL found in Kie.ai response");
    }

    console.log(`[check-job-status] Generation completed: ${resultUrl}`);

    // Download the generated image
    const imageBytes = await downloadFile(resultUrl);

    // Upload to Supabase storage
    const userId = job.user_id as string;
    const resultType = job.result_type || 'image'
    const jobType = resultType === 'video' ? 'video' : 'image'
    // Determine folder based on job's original generation type
    const hasImages = job.has_images || job.image_ids?.length > 0
    const folderName = hasImages ? `image-to-${jobType}` : `text-to-${jobType}`
    const key = `${userId}/${folderName}/${jobId}-${Date.now()}.${jobType === 'video' ? 'mp4' : 'png'}`;

    const { error: uploadError } = await supabase.storage
      .from("results")
      .upload(key, imageBytes, {
        contentType: jobType === 'video' ? "video/mp4" : "image/png",
        upsert: true
      });

    if (uploadError) throw new Error(uploadError.message);

    // Update job as completed
    await supabase.from("jobs").update({ 
      status: "completed", 
      result_url: key,
      updated_at: new Date().toISOString()
    }).eq("id", jobId);

    // Save metadata
    const fileName = key.split("/").pop() || key;
    const displayName = job.custom_name || job.prompt || "Generated Image";
    await supabase.from("generated_ads_metadata").upsert({
      file_name: fileName,
      custom_name: displayName,
      user_id: userId,
      folder_id: null
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: "completed", 
        result_url: key,
        jobId 
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[check-job-status] Error:`, err);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(err?.message ?? err) 
      }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve((req) => handler(req));