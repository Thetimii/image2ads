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
  console.log(`[generate-image-video] Handler called with method: ${req.method}`);
  console.log(`[generate-image-video] Origin: ${req.headers.get("origin")}`);
  console.log(`[generate-image-video] User-Agent: ${req.headers.get("user-agent")}`);
  
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    console.log(`[generate-image-video] OPTIONS request handled`);
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    console.log(`[generate-image-video] Non-POST method rejected: ${req.method}`);
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  let jobId: string | null = null;

  try {
    console.log(`[generate-image-video] Starting POST request processing`);
    const body = await req.json();
    console.log(`[generate-image-video] Request body parsed:`, body);
    jobId = body?.jobId ?? null;
    if (!jobId) return new Response("Job ID required", { status: 400, headers: cors });

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

    // Get reference image
    const imageIds = Array.isArray(job.image_ids) ? job.image_ids : [];
    if (imageIds.length === 0) {
      return new Response("No reference image provided", { status: 400, headers: cors });
    }

    const { data: img } = await supabase
      .from("images")
      .select("file_path")
      .eq("id", imageIds[0])
      .single();
    
    if (!img) {
      return new Response("Reference image not found", { status: 404, headers: cors });
    }

    // Get signed URL for the image (private bucket)
    const imageUrl = await getImageUrl(img.file_path);

    // Check and consume credits (8 credits for video generation)
    const { data: creditResult, error: creditError } = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: 8
    });
    
    if (creditError || !creditResult) {
      return new Response("Insufficient credits", {
        status: creditError ? 500 : 402,
        headers: cors
      });
    }

    // Update job status to processing
    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    // Get aspect ratio from job.aspect_ratio field (landscape or portrait)
    // Convert to Veo 3.1 format: landscape -> 16:9, portrait -> 9:16
    console.log(`[generate-image-video] RAW job.aspect_ratio value:`, job.aspect_ratio, `(type: ${typeof job.aspect_ratio})`)
    const rawAspectRatio = job.aspect_ratio || 'landscape'  // Default to landscape
    const aspectRatio = rawAspectRatio === 'portrait' ? '9:16' : '16:9'; // Convert to Veo format

    console.log(`[generate-image-video] Creating task for job ${jobId}`);
    console.log(`[generate-image-video] Reference image: ${imageUrl}`);
    console.log(`[generate-image-video] Original prompt from job: "${job.prompt}"`);
    console.log(`[generate-image-video] Aspect ratio from job: ${rawAspectRatio} -> Veo format: ${aspectRatio}`);

    const finalPrompt = job.prompt || "Animate this image";
    console.log(`[generate-image-video] Final prompt to send: "${finalPrompt}"`);

    // Create Kie.ai task for Veo 3.1 Fast image-to-video
    const taskPayload = {
      prompt: finalPrompt,
      imageUrls: [imageUrl], // Note: camelCase for Veo API
      model: 'veo3_fast',
      generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
      aspectRatio: aspectRatio,
      enableTranslation: true, // Auto-translate prompts to English for better results
    };
    console.log(`[generate-image-video] Task payload:`, taskPayload);

    const kieModel = 'veo3_fast'
    console.log('[generate-image-video] Veo 3.1 model:', kieModel, 'payload:', taskPayload)
    const taskId = await createKieTask(kieModel, taskPayload, KIE_API_KEY)

    console.log(`[generate-image-video] Task created: ${taskId}`);

    // Update job with task_id, source image URL, and keep status as processing
    await supabase.from("jobs").update({ 
      task_id: taskId,
      result_type: "video",
      source_image_url: imageUrl,
      status: "processing"
    }).eq("id", jobId);

    // Log usage event immediately (credits already consumed)
    const userId = job.user_id as string;
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: "image-to-video",
      credits_consumed: 8
    });

    // Return immediately with task info - frontend will poll for results
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId, 
        taskId, 
        status: "processing",
        result_type: "video",
        message: "Task created successfully. Result will be available shortly."
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[generate-image-video] Error:`, err);
    
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
