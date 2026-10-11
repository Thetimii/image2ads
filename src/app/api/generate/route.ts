import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { edgeFunctionUrl, internalFunctionHeaders } from "@/lib/edge-functions";

// Folder-page "Generate ad" (image -> image). Creates the job as the signed-in
// user, then hands it to the same `generate` edge function the studio uses -
// pricing, free-tier limits, kie.ai submission and refunds all live there.
// The job completes asynchronously (kie.ai callback); the folder page picks
// the result up from the jobs list.

const bodySchema = z.object({
  image_ids: z.array(z.string().uuid()).min(1).max(10).optional(),
  imageIds: z.array(z.string().uuid()).min(1).max(10).optional(),
  prompt: z.string().trim().min(1, "Prompt is required").max(2000),
  aspect_ratio: z.enum(["square", "portrait", "landscape"]).default("square"),
  custom_name: z.string().trim().min(1).max(255).optional(),
  model: z.string().optional(), // legacy "openai-medium-*" values are ignored
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data", details: parsed.error.issues }, { status: 400 });
  }
  const imageIds = parsed.data.image_ids ?? parsed.data.imageIds ?? [];
  if (imageIds.length === 0) return NextResponse.json({ error: "At least one image is required" }, { status: 400 });

  const { data: images } = await supabase.from("images").select("id").in("id", imageIds).eq("user_id", user.id);
  if (!images || images.length !== imageIds.length) {
    return NextResponse.json({ error: "One or more images not found or not owned by user" }, { status: 404 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      model: "gemini",
      prompt: parsed.data.prompt,
      custom_name: parsed.data.custom_name ?? null,
      result_type: "image",
      has_images: true,
      image_ids: imageIds,
      image_id: imageIds[0],
      aspect_ratio: parsed.data.aspect_ratio,
    })
    .select()
    .single();
  if (jobErr || !job) {
    console.error("[api/generate] job insert failed:", jobErr);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  const headers = internalFunctionHeaders();
  if (!headers) return NextResponse.json({ error: "Generation is not configured" }, { status: 500 });

  const resp = await fetch(edgeFunctionUrl("generate"), {
    method: "POST",
    headers,
    body: JSON.stringify({ jobId: job.id, model: "nano-banana" }),
  });
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return NextResponse.json({ error: result.error ?? "Generation failed to start", code: result.code }, { status: resp.status });
  }

  return NextResponse.json({ job: { ...job, status: result.status ?? "processing" } }, { status: 201 });
}
