-- Set tutorial_completed to default FALSE for new users
ALTER TABLE public.profiles 
ALTER COLUMN tutorial_completed SET DEFAULT FALSE;

-- Update the handle_new_user function to explicitly set tutorial_completed to FALSE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits, tutorial_completed)
    VALUES (
        NEW.id, 
        NEW.email, 
        NEW.raw_user_meta_data->>'full_name', 
        2, -- 2 free credits
        FALSE -- Tutorial not completed by default
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users who haven't completed tutorial (optional - uncomment if needed)
-- UPDATE public.profiles SET tutorial_completed = FALSE WHERE tutorial_completed IS NULL;
