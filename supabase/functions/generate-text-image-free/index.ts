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

// --- Main handler ---
async function handler(req: Request) {
  console.log(`[generate-text-image] Handler called with method: ${req.method}`);
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  let jobId: string | null = null;

  try {
    const body = await req.json();
    jobId = body?.jobId ?? null;
    const selectedModel = body?.model ?? 'nano-banana'; // Default to regular model
    const selectedResolution = body?.resolution ?? '2K'; // Default to 2K for Pro model
    
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

    // Determine credit cost based on model
    const creditAmount = selectedModel === 'nano-banana-pro' ? 6 : 1;
    console.log(`[generate-text-image] Model: ${selectedModel}, Credits: ${creditAmount}`);

    // Check and consume credits
    const { data: creditResult, error: creditError } = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: creditAmount
    });
    
    if (creditError || !creditResult) {
      return new Response("Insufficient credits", {
        status: creditError ? 500 : 402,
        headers: cors
      });
    }

    // Update job status to processing
    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    // Determine aspect ratio
    let aspectRatio = "1:1"; // Default
    if (job.aspect_ratio === 'portrait') aspectRatio = "9:16";
    else if (job.aspect_ratio === 'landscape') aspectRatio = "16:9";
    else if (job.aspect_ratio === 'square') aspectRatio = "1:1";

    console.log(`[generate-text-image] Creating task for job ${jobId}`);
    console.log(`[generate-text-image] Model: ${selectedModel}, Aspect ratio: ${aspectRatio}`);

    // Prepare callback URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackUrl = `${supabaseUrl}/functions/v1/kie-callback`;

    // Create task based on selected model
    let taskId: string;
    let kieModel: string;
    let taskInput: any;

    if (selectedModel === 'nano-banana-pro') {
      // Nano Banana Pro with user-selected resolution (1K, 2K, or 4K)
      kieModel = "nano-banana-pro";
      taskInput = {
        prompt: job.prompt || "A beautiful landscape",
        image_input: [], // Empty for text-to-image
        aspect_ratio: aspectRatio,
        resolution: selectedResolution, // User-selected: 1K, 2K, or 4K
        output_format: "png"
      };
      console.log(`[generate-text-image] Using Pro model with ${selectedResolution} resolution`);
    } else {
      // Regular Nano Banana
      kieModel = "google/nano-banana";
      taskInput = {
        prompt: job.prompt || "A beautiful landscape",
        output_format: "png",
        image_size: aspectRatio
      };
    }

    console.log(`[generate-text-image] KIE Model: ${kieModel}, Input:`, taskInput);

    taskId = await createKieTask(kieModel, taskInput, KIE_API_KEY, callbackUrl);
    console.log(`[generate-text-image] Task created: ${taskId}`);

    // Update job with task_id and keep status as processing
    await supabase.from("jobs").update({ 
      task_id: taskId,
      result_type: "image",
      status: "processing"
    }).eq("id", jobId);

    // Log usage event immediately (credits already consumed)
    const userId = job.user_id as string;
    console.log(`[generate-text-image] Consuming ${creditAmount} credit(s) for user ${userId}, job ${jobId}`);
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: "text-to-image",
      credits_consumed: creditAmount
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
    console.error(`[generate-text-image] Error:`, err);
    
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
