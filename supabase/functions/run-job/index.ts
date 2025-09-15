import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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

// Handle OpenAI GPT Image 1 generation
async function handleOpenAIGeneration(
  job: any,
  jobId: string,
  openaiApiKey: string,
  model: string
) {
  console.log(
    `Starting OpenAI GPT Image 1 generation for job ${jobId} with model ${model}`
  );

  try {
    // Parse model to get quality and aspect ratio
    // Format: openai-{quality}-{aspect}
    // Example: openai-low-square, openai-medium-landscape, openai-high-portrait
    const parts = model.split("-");
    const quality = parts[1] || "low"; // low, medium, high
    const aspect = parts[2] || "square"; // square, landscape, portrait

    // Determine size and credit multiplier based on quality and aspect ratio
    let size: string;
    let creditMultiplier: number;

    if (quality === "low") {
      size =
        aspect === "square"
          ? "1024x1024"
          : aspect === "landscape"
          ? "1536x1024"
          : "1024x1536";
      creditMultiplier = 0.5;
    } else if (quality === "medium") {
      size =
        aspect === "square"
          ? "1024x1024"
          : aspect === "landscape"
          ? "1536x1024"
          : "1024x1536";
      creditMultiplier = 1;
    } else {
      // high
      size =
        aspect === "square"
          ? "1024x1024"
          : aspect === "landscape"
          ? "1536x1024"
          : "1024x1536";
      // High quality: 7 credits for all sizes
      creditMultiplier = 7;
    }

    console.log(
      `OpenAI GPT Image 1 settings: quality=${quality}, aspect=${aspect}, size=${size}, creditMultiplier=${creditMultiplier}`
    );

    // Check and deduct credits before processing
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", job.user_id)
      .single();

    if (profileError || !profile) {
      console.error("Failed to get user profile:", profileError);
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Failed to get user profile",
        })
        .eq("id", jobId);
      return;
    }

    if (profile.credits < creditMultiplier) {
      console.error(
        `Insufficient credits: ${profile.credits} < ${creditMultiplier}`
      );
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: `Insufficient credits. Required: ${creditMultiplier}, Available: ${profile.credits}`,
        })
        .eq("id", jobId);
      return;
    }

    // Deduct credits
    const { error: creditError } = await supabase
      .from("profiles")
      .update({ credits: profile.credits - creditMultiplier })
      .eq("id", job.user_id);

    if (creditError) {
      console.error("Failed to deduct credits:", creditError);
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Failed to deduct credits",
        })
        .eq("id", jobId);
      return;
    }

    console.log(
      `Deducted ${creditMultiplier} credits from user ${job.user_id}`
    );

    // Update job status to processing
    await supabase
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", jobId);

    // Call OpenAI GPT Image 1 for image generation
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: job.prompt,
          quality: quality,
          size: size,
          response_format: "b64_json",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "OpenAI GPT Image 1 API failed:",
        response.status,
        errorText
      );

      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: `OpenAI GPT Image 1 API failed: ${response.status} ${errorText}`,
        })
        .eq("id", jobId);
      return;
    }

    const result = await response.json();
    console.log("OpenAI GPT Image 1 result:", result);

    if (!result.data || !result.data[0] || !result.data[0].b64_json) {
      console.error("No image data in OpenAI GPT Image 1 response");

      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "No image data in OpenAI GPT Image 1 response",
        })
        .eq("id", jobId);
      return;
    }

    const b64Data = result.data[0].b64_json;

    // Convert base64 to buffer
    const imageBuffer = Uint8Array.from(atob(b64Data), (c) => c.charCodeAt(0));
    const fileName = `generated_${jobId}_${Date.now()}.png`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("Failed to upload image:", uploadError);

      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Failed to save generated image",
        })
        .eq("id", jobId);
      return;
    }

    // Save image record
    const { data: imageRecord, error: imageError } = await supabase
      .from("images")
      .insert({
        file_path: uploadData.path,
        file_name: fileName,
        user_id: job.user_id,
        folder_id: job.folder_id,
        file_size: imageBuffer.byteLength,
        content_type: "image/png",
      })
      .select()
      .single();

    if (imageError) {
      console.error("Failed to save image record:", imageError);

      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Failed to save image record",
        })
        .eq("id", jobId);
      return;
    }

    // Update job status to completed
    await supabase
      .from("jobs")
      .update({
        status: "completed",
        result_image_id: imageRecord.id,
      })
      .eq("id", jobId);

    console.log(`OpenAI job ${jobId} completed successfully`);
  } catch (error) {
    console.error("OpenAI generation error:", error);

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_message: (error as Error).message || "OpenAI generation failed",
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

    // Check if user has enough credits
    const canConsume = await supabase.rpc("consume_credit", {
      user_uuid: job.user_id,
      credit_amount: job.credits_used,
    });

    if (!canConsume.data) {
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: "Insufficient credits",
        })
        .eq("id", jobId);

      return new Response("Insufficient credits", { status: 400 });
    }

    // Get signed URLs for all source images
    const imageUrls = [];
    for (const imageId of job.image_ids) {
      // Get image details
      const { data: image, error: imageError } = await supabase
        .from("images")
        .select("file_path")
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

      // Create signed URL
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from("uploads")
        .createSignedUrl(image.file_path, 300); // 5 minutes

      if (urlError || !signedUrl) {
        console.error("Error creating signed URL:", urlError);
        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error_message: "Failed to access source images",
          })
          .eq("id", jobId);

        return new Response("Failed to access source images", { status: 500 });
      }

      imageUrls.push(signedUrl.signedUrl);
    }

    console.log("Calling FAL.ai with", imageUrls.length, "images");
    console.log("Image URLs:", imageUrls);
    console.log("Prompt:", job.prompt);
    console.log("Model:", job.model || "gemini");

    // Use fal.subscribe but with timeout handling
    console.log("Submitting request to FAL.ai...");

    const falApiKey = Deno.env.get("FAL_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!falApiKey) {
      throw new Error("FAL_KEY environment variable not set");
    }

    const model = job.model || "gemini";
    let submitUrl: string;
    let payload: any;
    let useOpenAI = false;

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
        max_images: 2, // Generate 2 variations for better selection
        enable_safety_checker: true,
        sync_mode: false,
      };
    } else if (model.startsWith("openai-")) {
      // OpenAI DALL-E 3 configuration with quality options
      useOpenAI = true;
      const quality = model.includes("low")
        ? "standard"
        : model.includes("medium")
        ? "standard"
        : "hd";
      const size = model.includes("low")
        ? "1024x1024"
        : model.includes("medium")
        ? "1024x1792"
        : "1792x1024";

      if (!openaiApiKey) {
        throw new Error("OPENAI_API_KEY environment variable not set");
      }

      submitUrl = "https://api.openai.com/v1/images/edits";
      // Note: OpenAI image editing requires different handling, we'll handle this in the submission section
    } else {
      // Gemini configuration (default)
      submitUrl = "https://queue.fal.run/fal-ai/gemini-25-flash-image/edit";
      payload = {
        prompt: job.prompt,
        image_urls: imageUrls,
        num_images: 2, // Generate 2 images for better selection
        output_format: "png", // Use PNG for better quality
        sync_mode: false, // Use URLs for better performance
      };
    }

    // Submit to appropriate API
    if (useOpenAI) {
      // Handle OpenAI DALL-E 3 image generation directly
      await handleOpenAIGeneration(job, jobId, openaiApiKey, model);
    } else {
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
    }

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
