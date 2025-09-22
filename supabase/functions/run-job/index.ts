// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deno global declarations
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// --- CORS ---
const ALLOWED_ORIGINS = new Set([
  "https://image2ad.com",
  "https://www.image2ad.com",
  "http://localhost:3000",
  "http://localhost:5173",
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
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

// --- Helpers ---
type AllowedMime = "image/png" | "image/jpeg" | "image/webp";
function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)
    return "image/jpeg";
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}
function isPng(bytes: Uint8Array) {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  );
}
function safeName(name: string, mime: AllowedMime) {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return name.includes(".") ? name : `${name}.${ext}`;
}
async function downloadFromKnownBuckets(filePath: string) {
  console.log(`[run-job] Attempting to download: ${filePath}`);
  
  for (const bucket of ["uploads", "results"] as const) {
    console.log(`[run-job] Checking bucket: ${bucket}`);
    const dl = await supabase.storage.from(bucket).download(filePath);
    
    if (dl.error) {
      console.log(`[run-job] Error in ${bucket}:`, dl.error.message);
    }
    
    if (dl.data && !dl.error) {
      console.log(`[run-job] Found file in ${bucket}, size: ${dl.data.size} bytes`);
      const blob = dl.data;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const ct = (blob.type || "").toLowerCase();
      let mime: AllowedMime | null =
        ct.startsWith("image/png") ? "image/png" :
        ct.startsWith("image/jpeg") ? "image/jpeg" :
        ct.startsWith("image/webp") ? "image/webp" :
        sniffMime(bytes);
      if (mime && bytes.byteLength > 0) {
        console.log(`[run-job] Successfully loaded ${bytes.byteLength} bytes as ${mime}`);
        return { bytes, mime };
      }
    }
  }
  
  console.error(`[run-job] File not found in any bucket: ${filePath}`);
  throw new Error(`Object not found in uploads/results for: ${filePath}`);
}

// --- OpenAI: edits with references (no mask) ---
async function openaiGenerateFromRefs({
  prompt,
  pngFiles,
  size = "1024x1024",
  quality = "medium",
  apiKey,
  timeoutMs = 60000,
  retryOnce = true,
}: {
  prompt: string;
  pngFiles: Array<{ bytes: Uint8Array; filename: string }>;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high";
  apiKey: string;
  timeoutMs?: number;
  retryOnce?: boolean;
}) {
  async function call() {
    const form = new FormData();
    form.append("model", "gpt-image-1"); // ✅ same as Python example
    form.append("prompt", prompt.trim());
    form.append("size", size);
    form.append("quality", quality);

    for (const f of pngFiles) {
      const name = f.filename.endsWith(".png") ? f.filename : `${f.filename}.png`;
      const buffer = f.bytes.slice().buffer; // Convert to regular ArrayBuffer
      form.append("image[]", new File([buffer], name, { type: "image/png" }));
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("openai-timeout"), timeoutMs);
    try {
      console.log("[run-job] OpenAI call (edits, refs)");
      const resp = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: ctrl.signal,
      });
      const text = await resp.text();
      console.log("[run-job] OpenAI resp", { status: resp.status });
      if (!resp.ok) throw new Error(text);

      const b64 = JSON.parse(text)?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image data in response");

      return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    } finally {
      clearTimeout(t);
    }
  }

  try {
    return await call();
  } catch (e: any) {
    if (retryOnce) {
      console.warn("[run-job] OpenAI retrying…", e.message);
      return await call();
    }
    throw e;
  }
}

// --- Prompt wrapper ---
function buildPrompt(clientPrompt: string) {
  const prefix = `
Generate a photorealistic commercial image from the reference photos.

Absolute requirements for TEXT:
- All existing labels/logos must be reproduced exactly.
- Text must be crystal-clear, sharp, and perfectly legible.
- No misspellings, distortions, or extra words.
`.trim();

  return `${prefix}\n\n${clientPrompt.trim()}`;
}

// --- Main handler ---
async function handler(req: Request) {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  let jobId: string | null = null;
  try {
    const body = await req.json();
    jobId = body?.jobId ?? null;
    if (!jobId) return new Response("Job ID required", { status: 400, headers: cors });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    const { data: job, error: jobErr } = await supabase.from("jobs").select("*").eq("id", jobId).single();
    if (jobErr || !job) return new Response("Job not found", { status: 404, headers: cors });

    console.log("[run-job] Job loaded", job);

    // Load reference images
    const files: Array<{ bytes: Uint8Array; filename: string; folder_id: string | null }> = [];
    for (const imageId of job.image_ids as string[]) {
      const { data: img, error: imgErr } = await supabase
        .from("images")
        .select("file_path, folder_id, original_name")
        .eq("id", imageId)
        .single();
      if (imgErr || !img) return new Response(`Image not found: ${imageId}`, { status: 404, headers: cors });

      const { bytes, mime } = await downloadFromKnownBuckets(img.file_path);
      const filename = safeName(img.original_name || img.file_path.split("/").pop() || "input", mime);
      if (!isPng(bytes)) {
        await supabase.from("jobs").update({ status: "failed", error_message: `Not PNG: ${filename}` }).eq("id", jobId);
        return new Response("Only PNG allowed", { status: 400, headers: cors });
      }
      files.push({ bytes, filename, folder_id: img.folder_id });
    }
    if (files.length === 0) return new Response("No images for job", { status: 400, headers: cors });

    const prompt: string = buildPrompt(job.prompt || "Create a clean studio ad shot of the product.");

    const model = job.model || "openai-medium-square";
    let size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024";
    let quality: "low" | "medium" | "high" = "medium";
    if (model.includes("-low-")) quality = "low";
    else if (model.includes("-medium-")) quality = "medium";
    else if (model.includes("-high-")) quality = "high";
    if (model.includes("-landscape")) size = "1536x1024";
    else if (model.includes("-portrait")) size = "1024x1536";

    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    // Deduct credits
    const { data: creditResult, error: creditError } = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: 1,
    });
    if (creditError || !creditResult) {
      await supabase.from("jobs").update({
        status: "error",
        error_message: creditError ? "Credit deduction failed" : "Insufficient credits",
      }).eq("id", jobId);
      return new Response("Credit error", { status: creditError ? 500 : 402, headers: cors });
    }

    // Call OpenAI
    const outBytes = await openaiGenerateFromRefs({
      prompt,
      pngFiles: files.map(f => ({ bytes: f.bytes, filename: f.filename })),
      size,
      quality,
      apiKey: OPENAI_API_KEY,
    });

    // Save to Supabase
    const userId = job.user_id as string;
    const targetFolderId = files[0].folder_id ?? "root";
    const key = `${userId}/${targetFolderId}/${jobId}-${Date.now()}.png`;
    const up = await supabase.storage.from("results").upload(key, outBytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (up.error) throw new Error(up.error.message);

    await supabase.from("jobs").update({ status: "completed", result_url: key }).eq("id", jobId);

    // ✅ Restore metadata block
    if (job.custom_name) {
      const fileName = key.split("/").pop() || key;
      const { error: metadataError } = await supabase
        .from("generated_ads_metadata")
        .upsert({
          file_name: fileName,
          custom_name: job.custom_name,
          user_id: userId,
          folder_id: targetFolderId,
        });
      if (metadataError) console.error("[run-job] Metadata entry failed", metadataError);
    }

    return new Response(JSON.stringify({ success: true, jobId, result_path: key }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    if (jobId) {
      await supabase.from("jobs").update({ status: "failed", error_message: String(err?.message ?? err) }).eq("id", jobId);
    }
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}

Deno.serve((req) => handler(req));
