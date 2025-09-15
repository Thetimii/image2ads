import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Helper functions for image validation and MIME detection
function sniffMime(bytes: Uint8Array): "image/png"|"image/jpeg"|"image/webp"|null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length > 8 &&
      bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4E && bytes[3]===0x47 &&
      bytes[4]===0x0D && bytes[5]===0x0A && bytes[6]===0x1A && bytes[7]===0x0A) return "image/png";
  // JPEG: FF D8 FF
  if (bytes.length > 3 && bytes[0]===0xFF && bytes[1]===0xD8 && bytes[2]===0xFF) return "image/jpeg";
  // WEBP: "RIFF....WEBP"
  if (bytes.length > 12 &&
      bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46 &&
      bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50) return "image/webp";
  return null;
}

function safeName(name: string, mime: string) {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return name.includes(".") ? name : `${name}.${ext}`;
}

// Try to sign + download from uploads, then results.
// IMPORTANT: createSignedUrl doesn't verify object existence, so we must download and sniff.
async function fetchImageFromEitherBucket(filePath: string): Promise<{ bytes: Uint8Array; mime: "image/png"|"image/jpeg"|"image/webp"; }> {
  for (const bucket of ["uploads", "results"] as const) {
    const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 1200);
    if (error || !signed) continue;

    const res = await fetch(signed.signedUrl, { redirect: "follow" });
    if (!res.ok) continue;

    const buf = new Uint8Array(await res.arrayBuffer());
    const detected = sniffMime(buf);
    if (detected) return { bytes: buf, mime: detected };
    // If we got here, it was probably HTML/JSON — try next bucket.
  }
  throw new Error(`Could not fetch a valid image for path: ${filePath}`);
}

type ImagePart = { bytes: Uint8Array; mime: "image/png"|"image/jpeg"|"image/webp"; filename: string };

// Helper function for GPT Image 1 edits with validation and proper MIME detection
async function gptImageEdit({
  prompt,
  parts,
  openaiApiKey,
  quality = "medium",
  size = "1024x1024",
  outputFormat = "png",
}: {
  prompt: string;
  parts: ImagePart[];
  openaiApiKey: string;
  quality?: "low" | "medium" | "high";
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  outputFormat?: "png" | "jpeg" | "webp";
}) {
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("quality", quality);
  form.append("size", size);
  form.append("output_format", outputFormat);

  parts.forEach(({ bytes, mime, filename }) => {
    form.append("image[]", new Blob([new Uint8Array(bytes)], { type: mime }), filename);
  });

  const resp = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: form, // let fetch set boundary
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`gpt-image-1 edits failed: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data in response");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Polling function to check FAL.ai job status
async function pollForResult(
  requestId: string,
  jobId: string,
  userId: string,
  falApiKey: string,
  model: string = "gemini"
) {
  console.log(
    `Starting to poll for result: ${requestId} using model: ${model}`
  );

  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  // Determine the correct endpoint based on model
  const baseEndpoint =
    model === "seedream" ? "fal-ai/bytedance" : "fal-ai/gemini-25-flash-image";

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    try {
      console.log(`Polling attempt ${attempts} for request ${requestId}`);

      // Check status
      const statusResponse = await fetch(
        `https://queue.fal.run/${baseEndpoint}/requests/${requestId}/status`,
        {
          headers: {
            Authorization: `Key ${falApiKey}`,
          },
        }
      );

      if (!statusResponse.ok) {
        console.error("Status check failed:", statusResponse.status);
        continue;
      }

      const statusResult = await statusResponse.json();
      console.log("Status result:", statusResult);

      if (statusResult.status === "COMPLETED") {
        // Get the final result
        const resultResponse = await fetch(
          `https://queue.fal.run/${baseEndpoint}/requests/${requestId}`,
          {
            headers: {
              Authorization: `Key ${falApiKey}`,
            },
          }
        );

        if (!resultResponse.ok) {
          throw new Error("Failed to get final result");
        }

        const result = await resultResponse.json();
        console.log("FAL.ai final result:", result);

        // Process the result - handle multiple images
        let generatedImageUrls = [];
        if (result.images && result.images.length > 0) {
          generatedImageUrls = result.images.map((img: any) => img.url);
        } else if (
          result.data &&
          result.data.images &&
          result.data.images.length > 0
        ) {
          generatedImageUrls = result.data.images.map((img: any) => img.url);
        } else {
          throw new Error("No images found in result");
        }

        console.log("Generated image URLs:", generatedImageUrls);

        // Store all generated images and let user choose the best one
        const storedImagePaths = [];
        for (let i = 0; i < generatedImageUrls.length; i++) {
          const imageResponse = await fetch(generatedImageUrls[i]);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download generated image ${i + 1}`);
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const fileName = `${userId}/${jobId}-result.png`;

          // Upload result to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from("results")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            throw new Error(`Failed to save result image ${i + 1}`);
          }

          storedImagePaths.push(fileName);
          break; // Only save the first result
        }

        // Update job with all result URLs (comma-separated for now)
        await supabase
          .from("jobs")
          .update({
            status: "completed",
            result_url: storedImagePaths[0], // Primary result
            // TODO: Add multiple_results field to store all variations
          })
          .eq("id", jobId);

        console.log(`Job ${jobId} completed successfully`);
        return;
      } else if (statusResult.status === "FAILED") {
        throw new Error(
          `FAL.ai processing failed: ${statusResult.error || "Unknown error"}`
        );
      }

      // Continue polling if still in progress
      console.log(`Job still in progress, status: ${statusResult.status}`);
    } catch (error) {
      console.error("Error during polling:", error);
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: (error as Error).message,
        })
        .eq("id", jobId);
      return;
    }
  }

  // Timeout
  console.error("Polling timed out");
  await supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message: "Processing timed out",
    })
    .eq("id", jobId);
}

// Handle OpenAI GPT Image 1 edits (scene first, then references)
async function handleOpenAIEditCombination(
  job: any,
  jobId: string,
  openaiApiKey: string,
  parts: ImagePart[],
  targetFolderId: string | null
) {
  try {
    // Map your model string to gpt-image-1 params
    const quality: "low" | "medium" | "high" =
      job.model?.includes("-high") ? "high" :
      job.model?.includes("-low")  ? "low"  : "medium";

    const size: "1024x1024" | "1536x1024" | "1024x1536" =
      job.model?.endsWith("landscape") ? "1536x1024" :
      job.model?.endsWith("portrait")  ? "1024x1536" : "1024x1024";

    console.log(`OpenAI GPT Image 1 settings: quality=${quality}, size=${size}`);

    // No credit logic here—credits were already consumed via RPC earlier
    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    // Call edit function with ordered parts (first = scene)
    const bytes = await gptImageEdit({
      prompt: job.prompt,
      parts,
      openaiApiKey,
      quality,
      size,
      outputFormat: "png",
    });

    // Save result to the SAME FOLDER structure in results bucket
    const resultKey = `${job.user_id}/${targetFolderId}/${jobId}-${Date.now()}.png`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("results")
      .upload(resultKey, bytes, { contentType: "image/png" });

    if (uploadError) throw new Error(`Failed to upload result: ${uploadError.message}`);

    // Insert image record with correct column names
    const { data: imageRecord, error: imageError } = await supabase
      .from("images")
      .insert({
        file_path: resultKey,
        original_name: resultKey.split("/").pop()!,
        mime_type: "image/png",
        file_size: bytes.byteLength,
        user_id: job.user_id,
        folder_id: targetFolderId, // same folder as inputs
      })
      .select()
      .single();

    if (imageError) throw new Error(`Failed to insert image record: ${imageError.message}`);

    await supabase
      .from("jobs")
      .update({ status: "completed", result_image_id: imageRecord.id })
      .eq("id", jobId);

    console.log(`OpenAI edit job ${jobId} completed`);
  } catch (error) {
    console.error("OpenAI edit error:", error);
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_message: (error as Error).message ?? "OpenAI edit failed",
      })
      .eq("id", jobId);
  }
}

serve(async (request) => {
  let parsedBody: any = null;

  try {
    console.log("=== EDGE FUNCTION START ===");
    console.log("Edge function called with method:", request.method);
    console.log(
      "SUPABASE_URL:",
      Deno.env.get("SUPABASE_URL") ? "SET" : "MISSING"
    );
    console.log(
      "SUPABASE_SERVICE_ROLE_KEY:",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "SET" : "MISSING"
    );
    console.log("FAL_KEY:", Deno.env.get("FAL_KEY") ? "SET" : "MISSING");

    if (request.method !== "POST") {
      console.log("Method not allowed, returning 405");
      return new Response("Method not allowed", { status: 405 });
    }

    console.log("Reading request body...");
    const body = await request.text();
    console.log("Request body:", body);

    console.log("Parsing JSON...");
    try {
      parsedBody = JSON.parse(body);
      console.log("Parsed body:", JSON.stringify(parsedBody, null, 2));
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      return new Response("Invalid JSON", { status: 400 });
    }

    const { jobId } = parsedBody;

    if (!jobId) {
      console.log("No jobId provided, returning 400");
      return new Response("Job ID required", { status: 400 });
    }

    console.log(`Processing job: ${jobId}`);

    console.log("Fetching job from database...");
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    console.log("Database response:", { job, jobError });

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response("Job not found", { status: 404 });
    }

    console.log(
      `Processing job ${jobId} with ${job.image_ids?.length || 0} images`
    );
    console.log("Job data:", JSON.stringify(job, null, 2));

    // Update job status to processing
    await supabase
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", jobId);

    // Check if user has enough credits (always 1 credit per generation)
    const { data: canConsume, error: creditError } = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: 1,
    });

    if (creditError) {
      console.error("consume_credit RPC error:", creditError);
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: `Billing system error: ${creditError.message}`,
        })
        .eq("id", jobId);
      return new Response("Billing system error", { status: 500 });
    }

    if (!canConsume) {
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Insufficient credits",
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get images with proper metadata and bytes (preserves client order - scene first)
    const parts: ImagePart[] = [];          // keeps client order: first = scene/base, rest = references
    let targetFolderId: string | null = null;
    
    for (const imageId of job.image_ids) {
      // Get image details with metadata
      const { data: image, error: imageError } = await supabase
        .from("images")
        .select("file_path, folder_id, original_name")
        .eq("id", imageId)
        .single();

      if (imageError || !image) {
        console.error("Image not found:", imageError);
        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error_message: `Image not found: ${imageId}`,
          })
          .eq("id", jobId);

        return new Response("Image not found", { status: 404 });
      }

      // Use first input's folder for the result
      if (!targetFolderId) targetFolderId = image.folder_id;

      // Fetch actual image bytes from either bucket
      const { bytes, mime } = await fetchImageFromEitherBucket(image.file_path);

      const filename = safeName(
        image.original_name || image.file_path.split("/").pop() || "input",
        mime
      );

      parts.push({ bytes, mime, filename });
    }

    console.log("Calling API with", parts.length, "images");
    console.log("Input files:", parts.map(p => p.filename));
    console.log("Prompt:", job.prompt);
    console.log("Model:", job.model || "gemini");

    // Use fal.subscribe but with timeout handling
    console.log("Submitting request...");

    const falApiKey = Deno.env.get("FAL_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!falApiKey) {
      throw new Error("FAL_KEY environment variable not set");
    }

    const model = job.model || "gemini";

    if (model.startsWith("openai-")) {
      // Use gpt-image-1 composition to combine reference images
      if (!openaiApiKey) {
        throw new Error("OPENAI_API_KEY environment variable not set");
      }
      
      await handleOpenAIEditCombination(job, jobId, openaiApiKey, parts, targetFolderId);

      return new Response(
        JSON.stringify({ success: true, jobId, message: "OpenAI edit submitted and processed" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // For FAL.ai models, we need to create signed URLs from the parts
    // Convert parts back to URLs array for FAL.ai compatibility
    const imageUrls: string[] = [];
    for (const part of parts) {
      // Upload the bytes to a temporary location and create signed URL
      const tempKey = `temp/${jobId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${part.mime.split('/')[1]}`;
      
      const { error: tempUploadError } = await supabase.storage
        .from("uploads")
        .upload(tempKey, part.bytes, { contentType: part.mime });

      if (tempUploadError) {
        throw new Error(`Failed to create temp file for FAL.ai: ${tempUploadError.message}`);
      }

      const { data: signedUrl, error: urlError } = await supabase.storage
        .from("uploads")
        .createSignedUrl(tempKey, 3600); // 1 hour

      if (urlError || !signedUrl) {
        throw new Error("Failed to create signed URL for FAL.ai");
      }

      imageUrls.push(signedUrl.signedUrl);
    }

    // Handle FAL.ai models (gemini, seedream)
    let submitUrl: string;
    let payload: any;

    if (model === "seedream") {
      // ByteDance SeedDream v4 configuration
      submitUrl = "https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit";
      payload = {
        prompt: job.prompt,
        image_urls: imageUrls,
        image_size: {
          width: 4096,
          height: 4096,
        },
        num_images: 1,
        max_images: 2,
        enable_safety_checker: true,
        sync_mode: false,
      };
    } else {
      // Gemini configuration (default)
      submitUrl = "https://queue.fal.run/fal-ai/gemini-25-flash-image/edit";
      payload = {
        prompt: job.prompt,
        image_urls: imageUrls,
        num_images: 2,
        output_format: "png",
        sync_mode: false,
      };
    }
      // Submit to FAL.ai queue using direct HTTP
      const submitResponse = await fetch(submitUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${falApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        console.error(
          "FAL.ai submit failed:",
          submitResponse.status,
          errorText
        );
        throw new Error(
          `FAL.ai submit failed: ${submitResponse.status} ${errorText}`
        );
      }

      const submitResult = await submitResponse.json();
      console.log("FAL.ai submit result:", submitResult);
      const requestId = submitResult.request_id;

      if (!requestId) {
        throw new Error("No request_id received from FAL.ai");
      }

      // Start background polling (don't await to avoid timeout)
      setTimeout(async () => {
        await pollForResult(
          requestId,
          jobId,
          job.user_id,
          falApiKey,
          job.model || "gemini"
        );
      }, 1000);

    console.log(`Job ${jobId} submitted to FAL.ai, processing in background`);

    // Return success immediately - processing continues asynchronously
    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: "Job submitted to FAL.ai, processing in background",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("=== EDGE FUNCTION ERROR ===");
    console.error("Job processing error:", error);
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error?.constructor?.name);
    console.error("Error stack:", (error as Error)?.stack);

    // Update job status to failed if we have a jobId
    if (parsedBody?.jobId) {
      try {
        console.log("Updating job status to failed for job:", parsedBody.jobId);
        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error_message: (error as Error).message || "Unknown error",
          })
          .eq("id", parsedBody.jobId);
        console.log("Job status updated to failed");
      } catch (e) {
        console.error("Failed to update job status:", e);
      }
    }

    console.log("Returning 500 error response");
    return new Response(
      JSON.stringify({
        error: (error as Error).message || "Job processing failed",
        details: "Check function logs for more information",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
