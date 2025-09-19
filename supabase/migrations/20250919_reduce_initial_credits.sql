-- Reduce initial credits for new users from 10 to 3
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 3); -- 3 free credits
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;