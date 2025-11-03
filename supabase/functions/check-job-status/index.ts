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
    console.log(`[check-job-status] Incoming request: ${req.method} jobId=${jobId}`);
    // Minimal header echo (no auth secrets)
    console.log(`[check-job-status] Origin: ${req.headers.get('origin')}`);
    
    if (!jobId) {
      console.log('[check-job-status] Missing jobId param');
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
      console.log(`[check-job-status] Job not found for id=${jobId} error=${jobErr?.message}`);
      return new Response("Job not found", { status: 404, headers: cors });
    }

    console.log(`[check-job-status] Loaded job: status=${job.status} task_id=${job.task_id} result_url=${job.result_url}`);

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
    
    // Determine which API endpoint to use based on model
    // Veo models (from task_id prefix or job metadata) use different endpoint
    const isVeoTask = job.task_id.startsWith('veo_') || job.model?.includes('veo3');
    const endpoint = isVeoTask
      ? `https://api.kie.ai/api/v1/veo/get-task-info?taskId=${job.task_id}`
      : `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${job.task_id}`;
    
    console.log(`[check-job-status] Using endpoint: ${endpoint} (isVeoTask: ${isVeoTask})`);
    
    const response = await fetch(
      endpoint,
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
  console.log(`[check-job-status] Kie.ai response raw: ${JSON.stringify(result)}`);

    // Kie.ai schema differs by endpoint:
    // - Legacy /jobs/recordInfo: state: "waiting" | "generating" | "completed" | "failed"  
    // - Music /generate/record-info: status: "WAITING" | "FIRST_SUCCESS" | "SUCCESS" | "FAILED"
    // - Veo /veo/get-task-info: status: "pending" | "processing" | "success" | "failed"
    const taskState = (result.data?.state || '').toLowerCase();
    const taskStatus = (result.data?.status || '').toLowerCase(); // Veo uses lowercase
    
    // Check if resultJson has actual data (legacy format)
    let parsedResults = null;
    try {
      const resultJson = result.data?.resultJson || '';
      if (resultJson && resultJson !== '') {
        parsedResults = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
      }
    } catch (e) {
      console.log(`[check-job-status] Could not parse resultJson:`, e);
    }
    
    // For Veo tasks, check data.resultUrls directly (not in resultJson)
    const veoResultUrls = result.data?.resultUrls;
    
    console.log(`[check-job-status] Parsed - state: "${taskState}", status: "${taskStatus}", hasResultJson: ${!!parsedResults}, veoResultUrls: ${veoResultUrls?.length || 0}`);
    
    // Check for completion
    const isComplete = Boolean(
      taskState === 'completed' || 
      taskState === 'success' || 
      taskState === 'done' ||
      taskStatus === 'success' ||  // Veo uses lowercase 'success'
      taskStatus === 'SUCCESS' ||  // Music uses uppercase
      taskStatus === 'FIRST_SUCCESS' ||
      taskStatus === 'COMPLETED' ||
      taskStatus === 'completed' ||
      (veoResultUrls && Array.isArray(veoResultUrls) && veoResultUrls.length > 0) || // Veo format
      (parsedResults && (parsedResults.resultUrls || parsedResults.videoUrls || parsedResults.results)) // Legacy format
    );
    
    console.log(`[check-job-status] isComplete: ${isComplete}, resultJson empty: ${!result.data?.resultJson || result.data?.resultJson === ''}`);
    
    // CRITICAL FIX: If we have resultUrls in resultJson OR Veo's direct resultUrls, the task is complete
    const hasResultUrls = (parsedResults && (
      (Array.isArray(parsedResults.resultUrls) && parsedResults.resultUrls.length > 0) ||
      (Array.isArray(parsedResults.videoUrls) && parsedResults.videoUrls.length > 0)
    )) || (veoResultUrls && Array.isArray(veoResultUrls) && veoResultUrls.length > 0);
    
    if (hasResultUrls && !isComplete) {
      console.log(`[check-job-status] ⚠️ Task has result URLs but state still shows "${taskState}" - treating as complete!`);
    }
    
    if (!isComplete && !hasResultUrls) {
      const currentStatus = taskState || taskStatus.toLowerCase() || 'queued';
      
      // Check if job has been running too long (timeout check)
      const jobAge = Date.now() - new Date(job.created_at).getTime();
      const maxAge = job.result_type === 'video' ? 600000 : 300000; // 10min for video, 5min for others
      
      if (jobAge > maxAge) {
        console.log(`[check-job-status] Job timeout! Age: ${jobAge}ms, max: ${maxAge}ms, state: "${taskState}"`)
        await supabase.from('jobs').update({
          status: 'failed',
          error_message: `Generation timeout - Kie.ai task stuck in "${taskState}" state after ${Math.round(jobAge/1000)}s`,
          updated_at: new Date().toISOString()
        }).eq('id', jobId)
        return new Response(
          JSON.stringify({ 
            success: false,
            status: 'failed',
            error: `Generation timeout after ${Math.round(jobAge/1000)} seconds`,
            jobId
          }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      
      // Detect failure variants early
      if (['fail','failed','error'].includes(currentStatus)) {
        const failMsg = result.data?.failMsg || 'Generation failed'
        console.log(`[check-job-status] Task reported failure - state: "${taskState}", status: "${taskStatus}", failMsg: "${failMsg}"`)
        // Update job to failed
        await supabase.from('jobs').update({
          status: 'failed',
          error_message: failMsg,
          updated_at: new Date().toISOString()
        }).eq('id', jobId)
        return new Response(
          JSON.stringify({ 
            success: false,
            status: 'failed',
            error: failMsg,
            jobId
          }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      
      // Still processing - DON'T download/upload yet, just return status
      console.log(`[check-job-status] Task still processing - state: "${taskState}", status: "${taskStatus}", currentStatus: "${currentStatus}"`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'processing', 
          progress: currentStatus,
          message: 'Generation in progress',
          jobId 
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Task completed successfully - extract result URL(s)
    let resultUrl: string | null = null;
    let allUrls: string[] = []
    
    // Veo tasks return resultUrls directly in data (not in resultJson)
    if (veoResultUrls && Array.isArray(veoResultUrls)) {
      allUrls = veoResultUrls;
      console.log('[check-job-status] Found Veo resultUrls:', allUrls);
    } else {
      // Legacy format: parse resultJson
      try {
        const raw = result.data?.resultJson
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (parsed?.resultUrls && Array.isArray(parsed.resultUrls)) {
          allUrls = parsed.resultUrls
        }
        if (parsed?.videoUrls && Array.isArray(parsed.videoUrls)) {
          // Some providers might return videoUrls specifically
          allUrls = allUrls.concat(parsed.videoUrls)
        }
        if (parsed?.results && Array.isArray(parsed.results)) {
          // Generic fallback list
          allUrls = allUrls.concat(parsed.results.map((r: any) => r.url).filter(Boolean))
        }
      } catch (e) {
        console.log('[check-job-status] resultJson parse warning:', e)
      }
      // Direct fallbacks
      if (result.data?.resultUrl) allUrls.push(result.data.resultUrl)
      if (result.data?.videoUrl) allUrls.push(result.data.videoUrl)
    }
    
    // Deduplicate
    allUrls = [...new Set(allUrls.filter(Boolean))]
    
    // Prefer mp4 if job expects video
    if (job.result_type === 'video') {
      resultUrl = allUrls.find(u => /\.mp4(\?|$)/i.test(u)) || allUrls[0] || null
    } else {
      resultUrl = allUrls[0] || null
    }
    if (!resultUrl) {
      console.error('[check-job-status] No usable result URL. Aggregate list:', allUrls, 'Raw data:', JSON.stringify(result, null, 2))
      throw new Error('No result URL found in Kie.ai response')
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