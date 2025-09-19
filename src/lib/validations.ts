import { z } from "zod";

// User profile schema
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  credits: z.number().int().min(0),
  stripe_customer_id: z.string().optional(),
  subscription_id: z.string().optional(),
  subscription_status: z.string().optional(),
  tutorial_completed: z.boolean().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Folder schema
export const folderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Folder name is required").max(255),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(255),
});

// Image schema
export const imageSchema = z.object({
  id: z.string().uuid(),
  folder_id: z.string().uuid(),
  user_id: z.string().uuid(),
  original_name: z.string(),
  file_path: z.string(),
  file_size: z.number().int().optional(),
  mime_type: z.string().optional(),
  created_at: z.string(),
});

// Job schema
export const jobSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  image_ids: z.array(z.string().uuid()),
  prompt: z.string(),
  model: z.string().default("gemini"),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  result_url: z.string().optional(),
  error_message: z.string().optional(),
  custom_name: z.string().min(1, "Ad name is required"),
  credits_used: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createJobSchema = z
  .object({
    image_ids: z
      .array(z.string().uuid())
      .min(1, "At least one image is required")
      .max(10, "Maximum 10 images allowed")
      .optional(),
    imageIds: z
      .array(z.string().uuid())
      .min(1, "At least one image is required")
      .max(10, "Maximum 10 images allowed")
      .optional(),
    prompt: z
      .string()
      .min(1, "Prompt is required")
      .max(2000, "Prompt too long"),
    model: z
      .enum([
        "gemini",
        "seedream",
        "openai-low-square",
        "openai-low-landscape",
        "openai-low-portrait",
        "openai-medium-square",
        "openai-medium-landscape",
        "openai-medium-portrait",
        "openai-high-square",
        "openai-high-landscape",
        "openai-high-portrait",
      ])
      .default("gemini"),
    quality: z.enum(["low", "medium", "high"]).default("medium"),
    size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
    n: z.number().int().min(1).max(4).default(1),
    custom_name: z.string().min(1, "Ad name is required").max(255, "Name too long"),
  })
  .transform((v) => ({
    image_ids: v.image_ids ?? v.imageIds!,
    prompt: v.prompt,
    model: v.model,
    quality: v.quality,
    size: v.size,
    n: v.n,
    custom_name: v.custom_name,
  }));

// Upload URL request schema
export const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp)$/, "Invalid file type"),
  fileSize: z
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024), // 20MB max
  folderId: z.string().uuid(),
});

// Stripe schemas
export const createCheckoutSessionSchema = z.object({
  plan: z.enum(["starter", "pro", "business"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// Usage event schema
export const usageEventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_type: z.string(),
  credits_consumed: z.number().int(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;
export type Folder = z.infer<typeof folderSchema>;
export type CreateFolder = z.infer<typeof createFolderSchema>;
export type Image = z.infer<typeof imageSchema>;
export type Job = z.infer<typeof jobSchema>;
export type CreateJob = z.infer<typeof createJobSchema>;
export type UploadUrl = z.infer<typeof uploadUrlSchema>;
export type CreateCheckoutSession = z.infer<typeof createCheckoutSessionSchema>;
export type UsageEvent = z.infer<typeof usageEventSchema>;
