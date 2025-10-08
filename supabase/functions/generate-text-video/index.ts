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
  console.log(`[generate-text-video] Handler called with method: ${req.method}`);
  console.log(`[generate-text-video] Origin: ${req.headers.get("origin")}`);
  console.log(`[generate-text-video] User-Agent: ${req.headers.get("user-agent")}`);
  
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    console.log(`[generate-text-video] OPTIONS request handled`);
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    console.log(`[generate-text-video] Non-POST method rejected: ${req.method}`);
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  let jobId: string | null = null;

  try {
    console.log(`[generate-text-video] Starting POST request processing`);
    const body = await req.json();
    console.log(`[generate-text-video] Request body parsed:`, body);
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

    // Determine aspect ratio from model
    let aspectRatio = "landscape";
    if (job.model?.includes("-portrait")) aspectRatio = "portrait";

    console.log(`[generate-text-video] Creating task for job ${jobId} with prompt: ${job.prompt}`);

    // Create Kie.ai task for Sora 2 text-to-video
    const taskId = await createKieTask(
      "sora-2-text-to-video",
      {
        prompt: job.prompt || "A beautiful scene",
        aspect_ratio: aspectRatio
      },
      KIE_API_KEY
    );

    console.log(`[generate-text-video] Task created: ${taskId}`);

    // Update job with task_id
    // Update job with task_id and keep status as processing
    await supabase.from("jobs").update({ 
      task_id: taskId,
      result_type: "video",
      status: "processing"
    }).eq("id", jobId);

    // Log usage event immediately (credits already consumed)
    const userId = job.user_id as string;
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: "text-to-video",
      credits_consumed: 8
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
    console.error(`[generate-text-video] Error:`, err);
    
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
