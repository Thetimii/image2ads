-- Add cookie preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN cookie_preferences JSONB DEFAULT '{"necessary": true, "analytics": false, "marketing": false, "functional": false}'::jsonb;