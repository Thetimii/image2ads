-- Add Kie.ai-related columns to jobs table
-- Migration: 20251008_add_kie_columns_to_jobs.sql

-- Add task_id to store Kie.ai task ID for polling
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS task_id text;

-- Add result_type to differentiate between image and video outputs
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS result_type text DEFAULT 'image';

-- Add source_image_url for image-to-image and image-to-video workflows
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS source_image_url text;

-- Add comment for documentation
COMMENT ON COLUMN jobs.task_id IS 'Kie.ai task ID returned from createTask endpoint';
COMMENT ON COLUMN jobs.result_type IS 'Type of generated content: image or video';
COMMENT ON COLUMN jobs.source_image_url IS 'Public URL of source image for image-based generation';
