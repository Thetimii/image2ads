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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": acrh,
    "Access-Control-Expose-Headers": "content-type",
    "Vary": "Origin, Access-Control-Request-Headers"
  };
}

// --- MIME + helpers ---
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8) return "image/jpeg";
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/webp";
  return null;
}
function isPng(bytes: Uint8Array) {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E;
}
async function ensurePng(input: Uint8Array, filename: string) {
  const name = filename.toLowerCase().endsWith(".png")
    ? filename
    : filename.replace(/\.[^.]+$/, "") + ".png";
  return { png: input, filenamePng: name };
}

// --- Download helper ---
async function downloadFromKnownBuckets(filePath: string) {
  for (const bucket of ["uploads", "results"] as const) {
    const dl = await supabase.storage.from(bucket).download(filePath);
    if (dl.data && !dl.error) {
      const blob = dl.data;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const mime = sniffMime(bytes) || "image/png";
      return { bytes, mime };
    }
  }
  throw new Error("Object not found in uploads/results for: " + filePath);
}

// --- GPT-Image-1 generation (text or refs) ---
async function openaiGenerate({
  prompt,
  pngFiles,
  size = "1024x1024",
  quality = "medium",
  apiKey,
  timeoutMs = 60000
}: {
  prompt: string;
  pngFiles?: Array<{ bytes: Uint8Array; filename: string }>;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
  apiKey: string;
  timeoutMs?: number;
}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), timeoutMs);

  try {
    // ✅ 1. Choose correct endpoint based on what we have
    const hasRefs = pngFiles && pngFiles.length > 0;
    const hasPrompt = prompt && prompt.trim().length > 0;

    // Hybrid = has both image and text
    let mode = "TEXT-ONLY";
    let endpoint = "https://api.openai.com/v1/images/generations";

    if (hasRefs && hasPrompt) {
      mode = "HYBRID (image + text)";
      endpoint = "https://api.openai.com/v1/images/edits";
    } else if (hasRefs && !hasPrompt) {
      mode = "IMAGE-ONLY (visual re-render)";
      endpoint = "https://api.openai.com/v1/images/edits";
    }

    console.log(`[run-job] Generation mode: ${mode}`);
    console.log(`[run-job] Sending to ${endpoint} | hasRefs=${hasRefs} | hasPrompt=${hasPrompt}`);

    // ✅ 2. Build request
    let body: FormData | string;
    let headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };

    if (hasRefs) {
      // --- With reference images (use multipart/form-data)
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("size", size);
      form.append("quality", quality);

      // append prompt if present (for hybrid mode)
      if (hasPrompt) {
        form.append("prompt", prompt.trim());
      }

      // For edits endpoint, use only the first image as 'image' (not 'image[]')
      const firstFile = pngFiles[0];
      const mime = sniffMime(firstFile.bytes) || "image/png";
      const buffer = firstFile.bytes.slice().buffer;
      form.append("image", new File([buffer], firstFile.filename, { type: mime }));
      body = form;
    } else {
      // --- Text-only mode (use JSON)
      body = JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt.trim(),
        size,
        quality,
        n: 1
      });
      headers["Content-Type"] = "application/json";
    }

    // ✅ 3. Call API
    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: ctrl.signal
    });

    const text = await resp.text();
    if (!resp.ok) throw new Error(text);
    const b64 = JSON.parse(text)?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data in response");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } finally {
    clearTimeout(t);
  }
}

// --- Prompt enhancer ---
function buildPrompt(clientPrompt: string, isRef = false) {
  const realism = `
Generate a hyperrealistic, commercial-grade product image.
Use physically accurate lighting, materials, and reflections.
Preserve the original shape, proportions, and material finish of all reference products.
Do not stylize or redraw objects — reproduce them as they appear in the reference images.
  `.trim();

  const preservation = `
LABELS, TEXT & LOGOS PRESERVATION RULES:
- Exactly replicate all visible labels, printed text, and logos from the reference images.
- Copy all characters, spacing, and font shapes precisely — pixel perfect.
- Do not retype, regenerate, or reinterpret brand names or text.
- Keep the same orientation, color, and position of the text and logo.
- If multiple references exist, combine them naturally while keeping each logo identical.
  `.trim();

  const safe = `
IMAGE QUALITY:
- Photorealistic depth of field and shadows.
- Maintain clean edges, no distortion, and no text warping.
- Avoid adding extra text, watermarking, or new symbols.
  `.trim();

  // Combine depending on whether it's ref-based or text-only
  const prefix = isRef
    ? `${realism}\n\n${preservation}\n\n${safe}`
    : `${realism}\n\n${safe}`;

  return `${prefix}\n\n${clientPrompt.trim()}`;
}

// --- Main handler ---
async function handler(req: Request) {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  let jobId: string | null = null;

  try {
    const body = await req.json();
    jobId = body?.jobId ?? null;
    if (!jobId) return new Response("Job ID required", { status: 400, headers: cors });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobErr || !job)
      return new Response("Job not found", { status: 404, headers: cors });

    const imageIds = Array.isArray(job.image_ids) ? job.image_ids : [];
    console.log(`[run-job] Job analysis:`, {
      jobId: job.id,
      has_images: job.has_images,
      image_ids_length: imageIds.length,
      image_ids: imageIds
    });

    // Filter out placeholder images (text-only generation creates these)
    const realImageIds = [];
    for (const imageId of imageIds) {
      const { data: img, error: imgErr } = await supabase
        .from("images")
        .select("file_path, folder_id, original_name, metadata")
        .eq("id", imageId)
        .single();
      
      if (imgErr) {
        console.log(`[run-job] Error fetching image ${imageId}:`, imgErr);
        continue;
      }
      
      console.log(`[run-job] Checking image ${imageId}:`, {
        file_path: img.file_path,
        original_name: img.original_name,
        is_placeholder: img.metadata?.is_placeholder
      });
      
      // Skip placeholder images created for text-only generation
      if (img.file_path === "text-only-placeholder" || img.metadata?.is_placeholder) {
        console.log(`[run-job] Skipping placeholder image:`, img);
        continue;
      }
      
      realImageIds.push(imageId);
    }
    
    console.log(`[run-job] Real image IDs after filtering:`, realImageIds);

    // Load reference images if any exist
    const files: Array<{ bytes: Uint8Array; filename: string; folder_id: string | null }> = [];
    for (const imageId of realImageIds) {
      try {
        const { data: img } = await supabase
          .from("images")
          .select("file_path, folder_id, original_name")
          .eq("id", imageId)
          .single();
        const { bytes } = await downloadFromKnownBuckets(img.file_path);
        const { png, filenamePng } = await ensurePng(bytes, img.original_name);
        files.push({ bytes: png, filename: filenamePng, folder_id: img.folder_id });
        console.log(`[run-job] Loaded reference image: ${filenamePng}`);
      } catch (err) {
        console.error(`[run-job] Failed to load image ${imageId}:`, err);
      }
    }

    const hasReferenceImages = files.length > 0;
    const prompt = buildPrompt(job.prompt || "Create a clean studio ad shot of the product.", hasReferenceImages);

    let size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024";
    if (job.model?.includes("-landscape")) size = "1536x1024";
    else if (job.model?.includes("-portrait")) size = "1024x1536";

    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    const { data: creditResult, error: creditError } = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: 1
    });
    if (creditError || !creditResult)
      return new Response("Credit error", {
        status: creditError ? 500 : 402,
        headers: cors
      });

    console.log(`[run-job] Starting generation with ${files.length} files and prompt length ${prompt.length}`);
    
    const outBytes = await openaiGenerate({
      prompt,
      pngFiles: files, // Let openaiGenerate handle the logic
      size,
      quality: "medium",
      apiKey: OPENAI_API_KEY,
      timeoutMs: 90000 // 90 seconds timeout
    });
    
    console.log(`[run-job] Generation completed, result size: ${outBytes.length} bytes`);
    
    // Validate the result
    if (!outBytes || outBytes.length === 0) {
      throw new Error("Generation failed: Empty result from AI");
    }

    const userId = job.user_id as string;
    // Determine the correct result folder based on job type
    const resultFolder = job.has_images 
      ? (job.result_type === 'video' ? 'image-to-video' : 'image-to-image')
      : (job.result_type === 'video' ? 'text-to-video' : 'text-to-image');
    const key = userId + "/" + resultFolder + "/" + jobId + "-" + Date.now() + ".png";

    console.log(`[run-job] Uploading to storage with key: ${key}`);
    const up = await supabase.storage.from("results").upload(key, outBytes, {
      contentType: "image/png",
      upsert: true
    });
    if (up.error) {
      console.error(`[run-job] Storage upload failed:`, up.error);
      throw new Error(up.error.message);
    }
    console.log(`[run-job] Storage upload successful:`, up.data);

    console.log(`[run-job] Updating job status to completed with result_url: ${key}`);
    await supabase.from("jobs").update({ status: "completed", result_url: key }).eq("id", jobId);

    // Always save metadata with the prompt as the name
    const fileName = key.split("/").pop() || key;
    const displayName = job.custom_name || job.prompt || "Generated Image";
    await supabase.from("generated_ads_metadata").upsert({
      file_name: fileName,
      custom_name: displayName,
      user_id: userId,
      folder_id: null  // Use null for folder_id to match library expectations
    });

    return new Response(JSON.stringify({ success: true, jobId, result_path: key }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    if (jobId)
      await supabase
        .from("jobs")
        .update({ status: "failed", error_message: String(err?.message ?? err) })
        .eq("id", jobId);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
}

Deno.serve((req) => handler(req));
