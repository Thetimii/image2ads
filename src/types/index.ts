import type { Database } from './supabase'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Database table types
export type Profile = Tables<'profiles'>
export type Folder = Tables<'folders'>
export type Image = Tables<'images'>
export type Job = Tables<'jobs'>
export type UsageEvent = Tables<'usage_events'>

// Extended types with relations
export type JobWithImage = Job & {
  images: {
    original_name: string
    folder_id: string
  }
}

export type JobWithResult = Job & {
  result_signed_url?: string
}

// API response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface UploadUrlResponse {
  uploadUrl: string
  token: string
  filePath: string
  fileName: string
}

export interface JobsResponse {
  jobs: JobWithResult[]
}

export interface FoldersResponse {
  folders: Folder[]
}

// Form data types
export interface CreateFolderData {
  name: string
}

export interface UploadImageData {
  fileName: string
  fileType: string
  fileSize: number
  folderId: string
}

export interface GenerateJobData {
  image_id: string
  credits_used?: number
}

export interface CreateCheckoutSessionData {
  plan: 'starter' | 'pro' | 'business'
  successUrl: string
  cancelUrl: string
}

// Component props types
export interface DashboardProps {
  user: any // User from Supabase Auth
  profile: Profile
  initialFolders: Folder[]
}

export interface FolderProps {
  user: any // User from Supabase Auth
  profile: Profile
  folder: Folder
  initialImages: Image[]
}

export interface BillingProps {
  user: any // User from Supabase Auth
  profile: Profile
}

// Realtime payload types
export interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  schema: string
  table: string
}

// Error types
export interface AppError extends Error {
  code?: string
  details?: unknown
}

export interface ValidationError {
  field: string
  message: string
}

// Utility types
export type Nullable<T> = T | null
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>