import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as fal from "https://esm.sh/@fal-ai/client@0.14.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Configure FAL API
fal.config({
  credentials: Deno.env.get("FAL_API_KEY") ?? "",
});

serve(async (request) => {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return new Response("Job ID required", { status: 400 });
    }

    console.log(`Processing job: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response("Job not found", { status: 404 });
    }

    console.log(`Processing job ${jobId} with ${job.image_ids.length} images`);

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

    console.log("Calling FAL.ai SeDream v4 with", imageUrls.length, "images");

    // Call FAL.ai SeDream v4 API for image processing
    const result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
      input: {
        prompt: job.prompt,
        image_urls: imageUrls,
        image_size: "square_hd",
        num_images: 1,
        max_images: 1,
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log("Queue update:", update);
      },
    });

    if (
      !result.data ||
      !result.data.images ||
      result.data.images.length === 0
    ) {
      throw new Error("No images generated");
    }

    const generatedImageUrl = result.data.images[0].url;
    console.log("Generated image URL:", generatedImageUrl);

    // Download the generated image
    const imageResponse = await fetch(generatedImageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated image");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const fileName = `${job.user_id}/${jobId}-result.jpg`;

    // Upload result to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("results")
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to save result image");
    }

    // Update job with result
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "completed",
        result_url: fileName,
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Job update error:", updateError);
      throw new Error("Failed to update job status");
    }

    console.log(`Job ${jobId} completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        resultUrl: fileName,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Job processing error:", error);

    // Update job status to failed
    if (request.json) {
      try {
        const { jobId } = await request.json();
        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error_message: error.message || "Unknown error",
          })
          .eq("id", jobId);
      } catch (e) {
        console.error("Failed to update job status:", e);
      }
    }

    return new Response(
      JSON.stringify({
        error: error.message || "Job processing failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
