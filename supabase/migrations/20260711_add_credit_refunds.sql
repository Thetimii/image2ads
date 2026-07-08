-- Failed generations currently charge a credit with no way back: consume_credit
-- runs before the AI provider call, and every failure path just marks the job
-- failed with no refund. add_credits() exists but logs event_type='purchase',
-- so it isn't reused here (would pollute revenue analytics) - this adds a
-- dedicated, idempotent refund path instead.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id);

-- Idempotent by construction: the `refunded_at IS NULL` guard means calling
-- this twice for the same job (live failure path + retroactive backfill, or
-- two racing poll requests) never double-refunds. The UPDATE's row lock
-- serializes concurrent calls for the same job.
CREATE OR REPLACE FUNCTION refund_credit(user_uuid UUID, credit_amount INTEGER, job_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.jobs SET refunded_at = NOW()
  WHERE id = job_uuid AND refunded_at IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated > 0 THEN
    UPDATE public.profiles SET credits = credits + credit_amount, updated_at = NOW()
    WHERE id = user_uuid;

    INSERT INTO public.usage_events (user_id, event_type, credits_consumed, metadata, job_id)
    VALUES (user_uuid, 'refund', -credit_amount,
            jsonb_build_object('reason', 'generation_failed'), job_uuid);
  END IF;

  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
