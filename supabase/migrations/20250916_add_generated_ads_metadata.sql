-- Create generated_ads_metadata table to track custom names
-- This approach avoids the complexity of renaming files in storage

CREATE TABLE IF NOT EXISTS public.generated_ads_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT NOT NULL UNIQUE, -- The actual filename in storage (e.g., "jobId-timestamp.png")
    custom_name TEXT, -- User-provided custom name
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.generated_ads_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own generated ads metadata" ON public.generated_ads_metadata
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated ads metadata" ON public.generated_ads_metadata
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated ads metadata" ON public.generated_ads_metadata
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated ads metadata" ON public.generated_ads_metadata
    FOR DELETE USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_generated_ads_metadata_user_id ON public.generated_ads_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_ads_metadata_file_name ON public.generated_ads_metadata(file_name);

-- Add comment
COMMENT ON TABLE public.generated_ads_metadata IS 'Metadata for generated ads including custom names';