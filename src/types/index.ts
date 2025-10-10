import type { Database } from "./supabase";
import type { User } from "@supabase/supabase-js";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

// Database table types
export type Profile = Tables<"profiles">;
export type Folder = Tables<"folders">;
export type Image = Tables<"images">;
export type Job = Tables<"jobs">;
export type UsageEvent = Tables<"usage_events">;

// Extended types with relations
export type JobWithImage = Job & {
  images: {
    original_name: string;
    folder_id: string;
  };
};

export type JobWithResult = Job & {
  result_signed_url?: string;
};

// Generated Ad type for library display
export interface GeneratedAd {
  id: string;
  name?: string;
  custom_name?: string;
  file_path: string;
  url: string;
  folder_id: string;
  folder_name?: string;
  created_at: string;
  size: number;
  status: string;
  mediaType?: 'image' | 'video' | 'music';
  coverUrl?: string; // For music covers (note: different from cover_url for consistency)
  lyrics?: string; // For music lyrics
}

// API response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

// Component props types
export interface DashboardProps {
  user: User;
  profile: Profile;
  initialFolders: Folder[];
}

export interface FolderProps {
  user: User;
  profile: Profile;
  folder: Folder;
  initialImages: Image[];
}

export interface BillingProps {
  user: User;
  profile: Profile;
}

// Error types
export interface AppError extends Error {
  code?: string;
  details?: unknown;
}
