-- The initial refund_credit(user_uuid, credit_amount, job_uuid) trusted
-- caller-supplied user_uuid and credit_amount instead of deriving them from
-- the job itself, and was callable directly via PostgREST by anon/
-- authenticated roles (same exposure pattern as the pre-existing
-- consume_credit/add_credits). That combination let any caller mint
-- arbitrary credits: call it with their own user_uuid, a huge credit_amount,
-- and any unrefunded failed job_uuid (not even their own). Replacing it with
-- a version that looks up the user and amount from the job row itself, only
-- refunds jobs that are actually status='failed', and revoking public
-- execute so only the service-role edge functions can call it.
DROP FUNCTION IF EXISTS public.refund_credit(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.refund_credit(job_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  refund_amount INTEGER;
BEGIN
  SELECT user_id, COALESCE(credits_used, 1)
  INTO target_user_id, refund_amount
  FROM public.jobs
  WHERE id = job_uuid AND status = 'failed' AND refunded_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.jobs SET refunded_at = NOW() WHERE id = job_uuid;

  UPDATE public.profiles SET credits = credits + refund_amount, updated_at = NOW()
  WHERE id = target_user_id;

  INSERT INTO public.usage_events (user_id, event_type, credits_consumed, metadata, job_id)
  VALUES (target_user_id, 'refund', -refund_amount,
          jsonb_build_object('reason', 'generation_failed'), job_uuid);

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credit(uuid) FROM PUBLIC, anon, authenticated;
