-- Reduce initial credits for new users from 3 to 2
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 2); -- 2 free credits
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
