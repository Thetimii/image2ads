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

    // Determine image size from model
    let imageSize = "1:1";
    if (job.model?.includes("-landscape")) imageSize = "16:9";
    else if (job.model?.includes("-portrait")) imageSize = "9:16";

    console.log(`[generate-text-image] Creating task for job ${jobId} with prompt: ${job.prompt}`);

    // Create Kie.ai task
    const taskId = await createKieTask(
      "google/nano-banana",
      {
        prompt: job.prompt || "A beautiful landscape",
        output_format: "png",
        image_size: imageSize
      },
      KIE_API_KEY
    );

    console.log(`[generate-text-image] Task created: ${taskId}`);

    // Update job with task_id and keep status as processing
    await supabase.from("jobs").update({ 
      task_id: taskId,
      result_type: "image",
      status: "processing"
    }).eq("id", jobId);

    // Log usage event immediately (credits already consumed)
    const userId = job.user_id as string;
    console.log(`[generate-text-image] Consuming 1 credit for user ${userId}, job ${jobId}`);
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: "text-to-image",
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
