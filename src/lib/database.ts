import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/server";
import type { Profile, Folder, Image, Job } from "./validations";

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data;
}

/**
 * Update user profile with Stripe customer ID
 */
export async function updateUserStripeCustomerId(
  userId: string,
  stripeCustomerId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", userId);

  if (error) {
    console.error("Error updating user Stripe customer ID:", error);
    return false;
  }

  return true;
}

/**
 * Get user folders
 */
export async function getUserFolders(userId: string): Promise<Folder[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching folders:", error);
    return [];
  }

  return data || [];
}

/**
 * Create a new folder
 */
export async function createFolder(
  userId: string,
  name: string
): Promise<Folder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .insert({
      name,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating folder:", error);
    return null;
  }

  return data;
}

/**
 * Get folder by ID (with permission check)
 */
export async function getFolder(
  folderId: string,
  userId: string
): Promise<Folder | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("id", folderId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching folder:", error);
    return null;
  }

  return data;
}

/**
 * Get images in a folder
 */
export async function getFolderImages(
  folderId: string,
  userId: string
): Promise<Image[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("images")
    .select("*")
    .eq("folder_id", folderId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching images:", error);
    return [];
  }

  return data || [];
}

/**
 * Create an image record
 */
export async function createImage({
  folderId,
  userId,
  originalName,
  filePath,
  fileSize,
  mimeType,
}: {
  folderId: string;
  userId: string;
  originalName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}): Promise<Image | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("images")
    .insert({
      folder_id: folderId,
      user_id: userId,
      original_name: originalName,
      file_path: filePath,
      file_size: fileSize,
      mime_type: mimeType,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating image:", error);
    return null;
  }

  return data;
}

/**
 * Get user jobs
 */
export async function getUserJobs(userId: string): Promise<Job[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }

  return data || [];
}

/**
 * Create a new job
 */
export async function createJob({
  userId,
  imageIds,
  prompt,
  model = "gemini",
  creditsUsed = 1,
  customName,
  stylePreset = "photorealistic",
}: {
  userId: string;
  imageIds: string[];
  prompt: string;
  model?: string;
  creditsUsed?: number;
  customName?: string;
  stylePreset?: string;
}): Promise<Job | null> {
  const supabase = await createClient();

  // Handle text-only generation (no images)
  let imageId = imageIds[0];
  
  if (!imageId && imageIds.length === 0) {
    // Create a placeholder image record for text-only generation
    const { data: placeholderImage, error: placeholderError } = await supabase
      .from("images")
      .insert({
        user_id: userId,
        folder_id: null, // No folder for placeholder
        file_path: "text-only-placeholder",
        original_name: "Text-only generation",
        file_size: 0,
        mime_type: "text/plain",
        metadata: { is_placeholder: true, type: "text-only" }
      })
      .select()
      .single();

    if (placeholderError) {
      console.error("Error creating placeholder image:", placeholderError);
      return null;
    }
    
    imageId = placeholderImage.id;
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      image_id: imageId, // Use first image or placeholder for text-only
      image_ids: imageIds,
      prompt: prompt,
      model: model,
      credits_used: creditsUsed,
      custom_name: customName,
      style_preset: stylePreset,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating job:", error);
    return null;
  }

  return data;
}

/**
 * Get job by ID (with permission check)
 */
export async function getJob(
  jobId: string,
  userId: string
): Promise<Job | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching job:", error);
    return null;
  }

  return data;
}

/**
 * Generate signed URL for file download (using service client for results)
 */
export async function getSignedUrl(
  bucket: "uploads" | "results",
  filePath: string,
  expiresIn: number = 300
): Promise<string | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Generate upload URL with expiry
 */
export async function generateUploadUrl(
  bucket: "uploads",
  filePath: string,
  expiresIn: number = 60
): Promise<{ signedUrl: string; token: string } | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath, {
      upsert: true,
    });

  if (error) {
    console.error("Error creating upload URL:", error);
    return null;
  }

  return data;
}
