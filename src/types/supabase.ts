export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          credits: number
          stripe_customer_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          credits?: number
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          credits?: number
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      folders: {
        Row: {
          id: string
          name: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      images: {
        Row: {
          id: string
          folder_id: string
          user_id: string
          original_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          folder_id: string
          user_id: string
          original_name: string
          file_path: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          folder_id?: string
          user_id?: string
          original_name?: string
          file_path?: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          image_id: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          result_url: string | null
          error_message: string | null
          credits_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_id: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          result_url?: string | null
          error_message?: string | null
          credits_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          image_id?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          result_url?: string | null
          error_message?: string | null
          credits_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      usage_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          credits_consumed: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          credits_consumed: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          credits_consumed?: number
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credit: {
        Args: {
          user_uuid: string
          credit_amount?: number
        }
        Returns: boolean
      }
      add_credits: {
        Args: {
          user_uuid: string
          credit_amount: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}