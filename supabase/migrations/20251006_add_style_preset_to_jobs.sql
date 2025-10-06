-- Add style_preset column to jobs table
ALTER TABLE jobs ADD COLUMN style_preset text DEFAULT 'photorealistic';

-- Add comment to document the column
COMMENT ON COLUMN jobs.style_preset IS 'Style preset used for image generation (photorealistic, hyperrealistic, artistic, etc.)';