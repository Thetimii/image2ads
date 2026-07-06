-- 1. Bump free signup credits from 2 to 3, so "3 free nano-banana-pro images"
--    (at 1 credit each, see below) is exactly accurate.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 3); -- 3 free credits
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Track which jobs used the pro model, so downloads of those specific
--    images can be watermarked for free-tier users while everything else
--    (regular nano-banana, video, music) stays untouched. Defaults false,
--    so historical jobs are never retroactively watermarked.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS used_pro_model BOOLEAN NOT NULL DEFAULT FALSE;
