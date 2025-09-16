-- Allow folder_id to be null for generated images
-- Generated images appear in "Generated Ads" section, not in user folders

-- First, drop the NOT NULL constraint on folder_id
ALTER TABLE public.images 
ALTER COLUMN folder_id DROP NOT NULL;

-- Update the foreign key constraint to allow null values
-- Drop the existing constraint first
ALTER TABLE public.images 
DROP CONSTRAINT IF EXISTS images_folder_id_fkey;

-- Add the constraint back allowing null values
ALTER TABLE public.images 
ADD CONSTRAINT images_folder_id_fkey 
FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN public.images.folder_id IS 'NULL for generated images (appear in Generated Ads), UUID for uploaded images (appear in specific folders)';