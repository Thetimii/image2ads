# Database Migration Guide

## Important: Run this SQL in your Supabase SQL Editor

You need to run the following SQL commands in your Supabase dashboard to update the jobs table for multiple image support:

### Step 1: Go to Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Open your project: `cqnaooicfxqtnbuwsopu`
3. Go to "SQL Editor" in the left sidebar

### Step 2: Run the Migration SQL

Copy and paste this SQL into the SQL Editor and click "Run":

**If you're getting a constraint error, run this cleanup first:**

```sql
-- Fix existing empty prompts
UPDATE public.jobs
SET prompt = 'Transform this image into a professional advertisement with clean background and marketing appeal'
WHERE prompt IS NULL OR trim(prompt) = '';

-- Remove the constraint if it was already added and failed
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_prompt_not_empty;
```

**Then run the full migration:**

```sql
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

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 3: Verify the Migration

After running the SQL, you can verify it worked by running this query:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'jobs' AND table_schema = 'public';
```

You should see the new `image_ids` and `prompt` columns.

### Step 4: Optional - Remove old image_id column (after testing)

Once you've tested that everything works, you can optionally remove the old column:

```sql
-- ONLY RUN THIS AFTER CONFIRMING EVERYTHING WORKS
-- ALTER TABLE public.jobs DROP COLUMN image_id;
```

## What Changed

1. **Multiple Images**: Jobs now support up to 10 images per generation
2. **Custom Prompts**: Users can enter custom prompts for their ad generation
3. **SeDream v4 API**: Updated to use the latest Bytedance SeDream v4 model
4. **Production URLs**: All redirect URLs now use image2ad.com instead of localhost

## Testing the New Features

After running the migration:

1. Deploy to Vercel (should work now with the build fixes)
2. Test uploading multiple images
3. Test the new generation modal with prompt input
4. Verify jobs are created with multiple images and prompts
