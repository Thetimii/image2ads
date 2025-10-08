-- Fix jobs table constraints to allow text-only generations
-- Migration: 20251008_fix_text_only_jobs.sql

-- Drop the constraint that requires image_ids to not be empty
ALTER TABLE public.jobs 
DROP CONSTRAINT IF EXISTS jobs_image_ids_not_empty;

-- Make image_id nullable since text-only jobs don't need images
ALTER TABLE public.jobs 
ALTER COLUMN image_id DROP NOT NULL;

-- Update existing rows to ensure consistency before adding new constraint
-- Fix rows where has_images is TRUE but image_id is NULL (set has_images to FALSE)
UPDATE public.jobs 
SET has_images = FALSE 
WHERE has_images = TRUE AND image_id IS NULL;

-- Fix rows where has_images is FALSE but image_id is NOT NULL (set has_images to TRUE)
UPDATE public.jobs 
SET has_images = TRUE 
WHERE has_images = FALSE AND image_id IS NOT NULL;

-- Ensure image_ids array is consistent with has_images flag
UPDATE public.jobs 
SET image_ids = '{}' 
WHERE has_images = FALSE AND (image_ids IS NULL OR array_length(image_ids, 1) > 0);

UPDATE public.jobs 
SET image_ids = ARRAY[image_id] 
WHERE has_images = TRUE AND image_id IS NOT NULL AND (image_ids IS NULL OR image_ids = '{}');

-- Add a new constraint that ensures either we have images OR it's a text-only job
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_valid_image_requirements 
CHECK (
  (has_images = TRUE AND array_length(image_ids, 1) > 0 AND image_id IS NOT NULL) OR
  (has_images = FALSE AND (image_ids = '{}' OR image_ids IS NULL) AND image_id IS NULL)
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT jobs_valid_image_requirements ON public.jobs IS 
'Ensures image fields are consistent with has_images flag - either all image fields are populated or none are';