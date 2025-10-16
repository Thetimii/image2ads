-- Add aspect_ratio column to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT 'landscape';

-- Add comment explaining the column
COMMENT ON COLUMN public.jobs.aspect_ratio IS 'Aspect ratio for the generated content: landscape, portrait, square, etc.';
