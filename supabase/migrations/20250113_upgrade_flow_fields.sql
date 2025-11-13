-- Migration: Add upgrade flow fields to profiles table
-- Date: 2025-11-13
-- Description: Adds pro_discount_expires_at, trial_end_at, subscription_status, and plan fields
--              Also updates default credits to 3 for new users

-- Add new fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pro_discount_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_end_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- Update subscription_status field to have a default if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN subscription_status TEXT DEFAULT 'free';
    ELSE
        -- Update existing column to have default
        ALTER TABLE public.profiles 
        ALTER COLUMN subscription_status SET DEFAULT 'free';
    END IF;
END $$;

-- Update the default credits from 2 to 3
ALTER TABLE public.profiles 
ALTER COLUMN credits SET DEFAULT 3;

-- Update the handle_new_user function to use 3 credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        credits,
        subscription_status,
        plan
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        NEW.raw_user_meta_data->>'full_name', 
        3,  -- 3 free credits
        'free',
        'free'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for trial expiration checks (performance optimization)
CREATE INDEX IF NOT EXISTS idx_profiles_trial_end_at 
ON public.profiles(trial_end_at) 
WHERE trial_end_at IS NOT NULL;

-- Add index for discount expiration checks
CREATE INDEX IF NOT EXISTS idx_profiles_discount_expires_at 
ON public.profiles(pro_discount_expires_at) 
WHERE pro_discount_expires_at IS NOT NULL;

-- Add comment to document field purposes
COMMENT ON COLUMN public.profiles.pro_discount_expires_at IS 'Stores the 15-minute deadline for the 20% OFF popup shown at 1 credit';
COMMENT ON COLUMN public.profiles.trial_end_at IS 'Stores when the user''s 3-day CHF 1 trial ends';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Can be: free, trialing, active, canceled';
COMMENT ON COLUMN public.profiles.plan IS 'Can be: free, pro_trial, pro. Simplifies UI rendering';
