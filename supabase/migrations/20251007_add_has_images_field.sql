-- Add has_images field to jobs table to properly track text-only vs reference-based generations
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS has_images BOOLEAN DEFAULT FALSE;

-- Update existing jobs to set has_images based on image_ids
UPDATE public.jobs 
SET has_images = (array_length(image_ids, 1) > 0)
WHERE has_images IS NULL;

-- Make has_images NOT NULL with default FALSE
ALTER TABLE public.jobs 
ALTER COLUMN has_images SET NOT NULL,
ALTER COLUMN has_images SET DEFAULT FALSE;

-- Add index for performance when filtering by has_images
CREATE INDEX IF NOT EXISTS idx_jobs_has_images ON public.jobs(has_images);