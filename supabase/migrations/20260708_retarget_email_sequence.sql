-- Replaces the single one-shot retarget email with a 3-step sequence.
-- One row per (user, step) sent, so each step is tracked independently and
-- can never be sent twice to the same user.
CREATE TABLE IF NOT EXISTS public.retarget_email_log (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    step TEXT NOT NULL, -- 'day1' | 'day3' | 'day7'
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, step)
);

ALTER TABLE public.retarget_email_log ENABLE ROW LEVEL SECURITY;
-- Service role only (the edge function) - no client access needed.

-- The old single-email flag is superseded by retarget_email_log.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email_retarget_sent;
