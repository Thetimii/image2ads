import { z } from 'zod'

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
  created_at: z.string(),
  updated_at: z.string(),
})

// Folder schema
export const folderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Folder name is required').max(255),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255),
})

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
})

// Job schema
export const jobSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  image_id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  result_url: z.string().optional(),
  error_message: z.string().optional(),
  credits_used: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
})

export const createJobSchema = z.object({
  image_id: z.string().uuid(),
  credits_used: z.number().int().min(1).default(1),
})

// Upload URL request schema
export const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/, 'Invalid file type'),
  fileSize: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
  folderId: z.string().uuid(),
})

// Stripe schemas
export const createCheckoutSessionSchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

// Usage event schema
export const usageEventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_type: z.string(),
  credits_consumed: z.number().int(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.string(),
})

export type Profile = z.infer<typeof profileSchema>
export type Folder = z.infer<typeof folderSchema>
export type CreateFolder = z.infer<typeof createFolderSchema>
export type Image = z.infer<typeof imageSchema>
export type Job = z.infer<typeof jobSchema>
export type CreateJob = z.infer<typeof createJobSchema>
export type UploadUrl = z.infer<typeof uploadUrlSchema>
export type CreateCheckoutSession = z.infer<typeof createCheckoutSessionSchema>
export type UsageEvent = z.infer<typeof usageEventSchema>