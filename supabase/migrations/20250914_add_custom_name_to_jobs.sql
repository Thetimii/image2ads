-- Add custom_name field to jobs table
-- This allows users to rename their generated ads

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.jobs.custom_name IS 'Custom name given by user to their generated ad';