// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createKieTask, pollKieResult, downloadFile } from "../utils/kieClient.ts";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": acrh,
    "Access-Control-Expose-Headers": "content-type",
    "Vary": "Origin, Access-Control-Request-Headers"
  };
}

// Helper: Get signed URL for uploaded image (works with private buckets)
async function getImageUrl(filePath: string): Promise<string> {
  // Try uploads bucket first with signed URL (private bucket)
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("uploads")
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (!uploadError && uploadData?.signedUrl) {
    return uploadData.signedUrl;
  }

  // Try results bucket with signed URL (private bucket)
  const { data: resultData, error: resultError } = await supabase.storage
    .from("results")
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (!resultError && resultData?.signedUrl) {
    return resultData.signedUrl;
  }

  throw new Error(`Could not get signed URL for: ${filePath}. Upload error: ${uploadError?.message}, Result error: ${resultError?.message}`);
}

// --- Main handler ---
async function handler(req: Request) {
  console.log(`[generate-image-image] *** HANDLER CALLED *** Method: ${req.method}`);
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    console.log(`[generate-image-image] OPTIONS request, returning CORS headers`);
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    console.log(`[generate-image-image] Invalid method: ${req.method}`);
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  let jobId: string | null = null;

  try {
    console.log(`[generate-image-image] Parsing request body...`);
    const body = await req.json();
    console.log(`[generate-image-image] Request body:`, body);
    jobId = body?.jobId ?? null;
    if (!jobId) {
      console.log(`[generate-image-image] ERROR: No jobId provided in body`);
      return new Response("Job ID required", { status: 400, headers: cors });
    }
    console.log(`[generate-image-image] SUCCESS: Processing jobId: ${jobId}`);

    const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
    if (!KIE_API_KEY) throw new Error("KIE_API_KEY not set");

    // Get job details
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    
    if (jobErr || !job)
      return new Response("Job not found", { status: 404, headers: cors });

    // Get reference image(s) - support multiple images
    const imageIds = Array.isArray(job.image_ids) ? job.image_ids : [];
    if (imageIds.length === 0) {
      return new Response("No reference image provided", { status: 400, headers: cors });
    }

    // Fetch all images
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("file_path")
      .in("id", imageIds);
    
    if (imagesError || !images || images.length === 0) {
      return new Response("Reference images not found", { status: 404, headers: cors });
    }

    // Get signed URLs for all images (private bucket)
    const imageUrls: string[] = [];
    for (const img of images) {
      const signedUrl = await getImageUrl(img.file_path);
      imageUrls.push(signedUrl);
    }

    console.log(`[generate-image-image] Processing ${imageUrls.length} image(s)`);
    console.log(`[generate-image-image] Image URLs:`, imageUrls);

    // Check and consume credits
    const { data: creditResult, error: creditError } = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: 1
    });
    
    if (creditError || !creditResult) {
      return new Response("Insufficient credits", {
        status: creditError ? 500 : 402,
        headers: cors
      });
    }

    // Update job status to processing
    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    // Determine image size from aspect_ratio field
    let imageSize = "16:9"; // Default to landscape
    if (job.aspect_ratio === 'portrait') imageSize = "9:16";
    else if (job.aspect_ratio === 'landscape') imageSize = "16:9";
    else if (job.aspect_ratio === 'square') imageSize = "1:1";

    console.log(`[generate-image-image] Raw job data:`, JSON.stringify(job, null, 2));
    console.log(`[generate-image-image] Job prompt value: "${job.prompt}"`);
    console.log(`[generate-image-image] Image URLs:`, imageUrls);
    console.log(`[generate-image-image] Aspect ratio: ${job.aspect_ratio}, Image size: ${imageSize}`);

    // Make sure we use the actual user prompt, with a fallback if needed
    const userPrompt = job.prompt && job.prompt.trim() !== '' ? job.prompt : "Transform this image";
    console.log(`[generate-image-image] Using prompt: "${userPrompt}"`);

    // Create Kie.ai task using nano-banana-edit with multiple images
    const taskPayload = {
      prompt: userPrompt,
      image_urls: imageUrls,
      output_format: "png",
      image_size: imageSize
    };
    console.log(`[generate-image-image] Kie.ai task payload:`, JSON.stringify(taskPayload, null, 2));

    const taskId = await createKieTask(
      "google/nano-banana-edit",
      taskPayload,
      KIE_API_KEY
    );

    console.log(`[generate-image-image] Task created: ${taskId}`);

    // Update job with task_id and keep status as processing
    await supabase.from("jobs").update({ 
      task_id: taskId,
      result_type: "image",
      status: "processing"
    }).eq("id", jobId);

    // Log usage event immediately (credits already consumed)
    const userId = job.user_id as string;
    console.log(`[generate-image-image] Consuming 1 credit for user ${userId}, job ${jobId}`);
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: "image-to-image",
      credits_consumed: 1
    });

    // Return immediately with task info - frontend will poll for results
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId, 
        taskId, 
        status: "processing",
        message: "Task created successfully. Result will be available shortly."
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[generate-image-image] Error:`, err);
    
    if (jobId) {
      await supabase
        .from("jobs")
        .update({ 
          status: "failed", 
          error_message: String(err?.message ?? err),
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);
    }
    
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve((req) => handler(req));
