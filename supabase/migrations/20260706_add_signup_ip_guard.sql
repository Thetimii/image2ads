-- Anti-abuse: cap free signup credits per IP address, without requiring
-- email verification. Accounts always get created and always work - only
-- the free credit grant is withheld past the threshold, so shared-IP
-- households/offices/mobile networks are never locked out, only repeat
-- account farming from the same connection stops being profitable.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip INET;

CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip ON public.profiles(signup_ip);

-- Called once, right after a new account is created (both email and OAuth
-- signup flows). Records the signup IP, and if 3 or more other profiles
-- already share that IP, zeroes out this profile's free credits.
CREATE OR REPLACE FUNCTION public.apply_signup_ip_guard(p_user_id UUID, p_ip INET)
RETURNS VOID AS $$
DECLARE
    v_existing_count INTEGER;
BEGIN
    IF p_ip IS NULL THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_existing_count
    FROM public.profiles
    WHERE signup_ip = p_ip AND id <> p_user_id;

    UPDATE public.profiles
    SET signup_ip = p_ip
    WHERE id = p_user_id;

    IF v_existing_count >= 3 THEN
        UPDATE public.profiles
        SET credits = 0
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.apply_signup_ip_guard(UUID, INET) FROM PUBLIC, anon, authenticated;
