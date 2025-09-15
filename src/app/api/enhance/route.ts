import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the image URL from request body
    const { imageUrl, jobId } = await request.json();

    if (!imageUrl || !jobId) {
      return NextResponse.json(
        { error: "Image URL and job ID are required" },
        { status: 400 }
      );
    }

    const vyroApiKey = process.env.VYRO_API_KEY;
    if (!vyroApiKey) {
      return NextResponse.json(
        { error: "VYRO API key not configured" },
        { status: 500 }
      );
    }

    // Download the image from Supabase storage
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 400 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBlob = new Blob([imageBuffer]);

    // Create form data for VYRO API
    const formData = new FormData();
    formData.append("image", imageBlob, "image.png");

    // Call VYRO AI enhancement API
    const enhanceResponse = await fetch(
      "https://api.vyro.ai/v2/image/enhance",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vyroApiKey}`,
        },
        body: formData,
      }
    );

    if (!enhanceResponse.ok) {
      const errorText = await enhanceResponse.text();
      console.error("VYRO API error:", errorText);
      return NextResponse.json(
        { error: "Failed to enhance image" },
        { status: 500 }
      );
    }

    // Get the enhanced image
    const enhancedImageBuffer = await enhanceResponse.arrayBuffer();

    // Save enhanced image to Supabase storage
    const enhancedFileName = `${user.id}/${jobId}-enhanced.png`;

    const { error: uploadError } = await supabase.storage
      .from("results")
      .upload(enhancedFileName, enhancedImageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to save enhanced image" },
        { status: 500 }
      );
    }

    // Create signed URL for the enhanced image
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from("results")
      .createSignedUrl(enhancedFileName, 3600); // 1 hour

    if (urlError || !signedUrl) {
      return NextResponse.json(
        { error: "Failed to create download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      enhancedImageUrl: signedUrl.signedUrl,
      filePath: enhancedFileName,
    });
  } catch (error) {
    console.error("Enhancement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
