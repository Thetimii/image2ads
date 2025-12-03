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
    const selectedModel = body?.model ?? 'nano-banana'; // Default to regular model
    const selectedResolution = body?.resolution ?? '2K'; // Default to 2K for Pro model

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

    // FREE TIER: No credit deduction
    // Instead, check daily limit (100 images/day)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count, error: countError } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", job.user_id)
      .gte("created_at", oneDayAgo.toISOString());

    if (countError) {
      console.error(`[generate-image-image-free] Error checking daily limit:`, countError);
      return new Response("Error checking limits", { status: 500, headers: cors });
    }

    if (count !== null && count >= 100) {
      console.log(`[generate-image-image-free] Daily limit reached for user ${job.user_id}: ${count}/100`);
      return new Response(
        JSON.stringify({
          error: "Daily free limit reached (100 images/day). Upgrade to Pro for unlimited generation.",
          code: "LIMIT_REACHED"
        }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-image-image-free] Daily limit check passed: ${count}/100`);

    // Update job status to processing
    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    // Determine aspect ratio
    let aspectRatio = "1:1"; // Default
    if (job.aspect_ratio === 'portrait') aspectRatio = "9:16";
    else if (job.aspect_ratio === 'landscape') aspectRatio = "16:9";
    else if (job.aspect_ratio === 'square') aspectRatio = "1:1";

    console.log(`[generate-image-image] Raw job data:`, JSON.stringify(job, null, 2));
    console.log(`[generate-image-image] Job prompt value: "${job.prompt}"`);
    console.log(`[generate-image-image] Image URLs:`, imageUrls);
    console.log(`[generate-image-image] Aspect ratio: ${job.aspect_ratio}`);

    // Make sure we use the actual user prompt, with a fallback if needed
    const userPrompt = job.prompt && job.prompt.trim() !== '' ? job.prompt : "Transform this image";
    console.log(`[generate-image-image] Using prompt: "${userPrompt}"`);

    // Prepare callback URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackUrl = `${supabaseUrl}/functions/v1/kie-callback`;

    // Create task based on selected model
    let taskId: string;
    let kieModel: string;
    let taskInput: any;

    if (selectedModel === 'nano-banana-pro') {
      // Nano Banana Pro with user-selected resolution (1K, 2K, or 4K) and image_input array
      kieModel = "nano-banana-pro";
      taskInput = {
        prompt: userPrompt,
        image_input: imageUrls, // Pro model uses image_input array
        aspect_ratio: aspectRatio,
        resolution: selectedResolution, // User-selected: 1K, 2K, or 4K
        output_format: "png"
      };
      console.log(`[generate-image-image] Using Pro model with ${selectedResolution} resolution`);
    } else {
      // Regular Nano Banana Edit
      kieModel = "google/nano-banana-edit";
      taskInput = {
        prompt: userPrompt,
        image_urls: imageUrls,
        output_format: "png",
        image_size: aspectRatio
      };
    }

    console.log(`[generate-image-image] KIE Model: ${kieModel}, Input:`, JSON.stringify(taskInput, null, 2));

    taskId = await createKieTask(kieModel, taskInput, KIE_API_KEY, callbackUrl);
    console.log(`[generate-image-image] Task created: ${taskId}`);

    // Update job with task_id and keep status as processing
    await supabase.from("jobs").update({
      task_id: taskId,
      result_type: "image",
      status: "processing"
    }).eq("id", jobId);

    // Log usage event (0 credits consumed)
    const userId = job.user_id as string;
    console.log(`[generate-image-image-free] Logging usage for user ${userId}, job ${jobId}`);
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: "image-to-image",
      credits_consumed: 0 // Free tier consumes 0 credits
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
