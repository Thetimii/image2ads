-- Update jobs table to support multiple images and prompt
-- First, add new columns
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS image_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS prompt TEXT DEFAULT '';

-- Copy existing image_id to image_ids array for backward compatibility
UPDATE public.jobs 
SET image_ids = ARRAY[image_id] 
WHERE image_ids = '{}' AND image_id IS NOT NULL;

-- Update existing jobs with empty prompts to have a default prompt
UPDATE public.jobs
SET prompt = 'Transform this image into a professional advertisement with clean background and marketing appeal'
WHERE prompt IS NULL OR trim(prompt) = '';

-- Update the validation to ensure image_ids is not empty
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_image_ids_not_empty 
CHECK (array_length(image_ids, 1) > 0);

-- Add constraint for maximum 10 images
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_max_10_images 
CHECK (array_length(image_ids, 1) <= 10);

-- Add constraint for prompt not empty (now safe to add after updating existing rows)
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_prompt_not_empty 
CHECK (length(trim(prompt)) > 0);

-- Update the jobs table trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists, then create new one
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();