# Database Schema Reference

This file contains the complete database schema for the Image2Ad application.

## Tables Overview

### `folders`

- `id` (uuid, NOT NULL, primary key)
- `name` (text, NOT NULL)
- `user_id` (uuid, NOT NULL)
- `created_at` (timestamp with time zone, default: now())
- `updated_at` (timestamp with time zone, default: now())

### `images`

- `id` (uuid, NOT NULL, primary key)
- `original_name` (text, NOT NULL)
- `file_path` (text, NOT NULL)
- `user_id` (uuid, NOT NULL)
- `folder_id` (uuid, nullable) - can be null for generated images
- `file_size` (integer, nullable)
- `mime_type` (text, nullable)
- `metadata` (jsonb, NOT NULL, default: '{}')
- `created_at` (timestamp with time zone, default: now())

### `jobs`

- `id` (uuid, NOT NULL, primary key)
- `user_id` (uuid, NOT NULL)
- `image_id` (uuid, NOT NULL) - **Note: NOT NULL constraint**
- `image_ids` (uuid[], nullable, default: '{}')
- `prompt` (text, nullable, default: '')
- `model` (USER-DEFINED, NOT NULL, default: 'gemini')
- `status` (text, NOT NULL, default: 'pending')
- `result_url` (text, nullable)
- `result_image_id` (uuid, nullable)
- `error_message` (text, nullable)
- `credits_used` (integer, nullable, default: 1)
- `custom_name` (text, nullable)
- `assets` (jsonb, nullable, default: '{}')
- `created_at` (timestamp with time zone, default: now())
- `updated_at` (timestamp with time zone, default: now())

### `profiles`

- `id` (uuid, NOT NULL, primary key)
- `email` (text, NOT NULL)
- `full_name` (text, nullable)
- `avatar_url` (text, nullable)
- `credits` (integer, nullable, default: 0)
- `stripe_customer_id` (text, nullable)
- `subscription_id` (text, nullable)
- `subscription_status` (text, nullable)
- `tutorial_completed` (boolean, nullable, default: true)
- `cookie_preferences` (jsonb, nullable, default: specific JSON)
- `created_at` (timestamp with time zone, default: now())
- `updated_at` (timestamp with time zone, default: now())

### `generated_ads_metadata`

- `id` (uuid, NOT NULL, primary key)
- `file_name` (text, NOT NULL)
- `custom_name` (text, nullable)
- `user_id` (uuid, NOT NULL)
- `folder_id` (uuid, nullable)
- `created_at` (timestamp with time zone, default: now())
- `updated_at` (timestamp with time zone, default: now())

### `usage_events`

- `id` (uuid, NOT NULL, primary key)
- `user_id` (uuid, NOT NULL)
- `event_type` (text, NOT NULL)
- `credits_consumed` (integer, NOT NULL)
- `metadata` (jsonb, nullable)
- `created_at` (timestamp with time zone, default: now())

## Important Notes

### Text-Only Generation Handling

Since `jobs.image_id` is NOT NULL, for text-only generation we create a placeholder image record with:

- `file_path`: "text-only-placeholder"
- `original_name`: "Text-only generation"
- `folder_id`: null
- `metadata`: `{"is_placeholder": true, "type": "text-only"}`

### Time Columns

- No `completed_at` column exists in jobs table
- Use `updated_at` for completion timestamp
- All timestamp columns use `timestamp with time zone`

### Storage Buckets

- `uploads` - for user uploaded images
- `results` - for generated ad images

### Key Constraints

- `jobs.image_id` is NOT NULL (requires placeholder for text-only)
- `images.folder_id` can be null (for generated images)
- `images.metadata` is NOT NULL with default '{}'
