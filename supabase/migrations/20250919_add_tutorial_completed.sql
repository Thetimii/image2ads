-- Add tutorial_completed field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tutorial_completed BOOLEAN DEFAULT FALSE;

-- Update the handle_new_user function to include tutorial_completed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits, tutorial_completed)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 3, FALSE); -- 3 free credits, tutorial not completed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;