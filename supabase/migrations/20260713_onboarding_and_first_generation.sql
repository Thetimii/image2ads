-- Phase 2 (onboarding rebuild + funnel analytics) support columns.

-- Guards the "first_generation_completed" event/CAPI fire to exactly once
-- per user, set atomically via `UPDATE ... WHERE first_generation_completed_at
-- IS NULL` from the server so it's race-safe across the app's 3 independent
-- completion-detection paths (polling, realtime, fallback re-poll).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_generation_completed_at TIMESTAMPTZ;

-- Lets generation_failed events (derived from jobs in user_journey) carry a
-- category (safety_filter/timeout/insufficient_credits/unknown) alongside
-- the human-readable error_message, without re-parsing the message later.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS failure_category TEXT;

-- Extend the existing journey view so 'generation_failed' rows include the
-- category, and 'generation_completed' is also emitted as 'generation_succeeded'
-- to match the funnel event naming used elsewhere (kept both for compatibility
-- with anything already querying 'generation_completed').
CREATE OR REPLACE VIEW public.user_journey AS
SELECT
    e.user_id,
    e.anonymous_id,
    e.session_id,
    e.event_name,
    e.page,
    e.properties,
    e.created_at
FROM public.analytics_events e
WHERE e.event_name <> 'ping'
UNION ALL
SELECT j.user_id, NULL, NULL, 'generation_started', NULL,
       jsonb_build_object('job_id', j.id, 'model', j.model), j.created_at
FROM public.jobs j
UNION ALL
SELECT j.user_id, NULL, NULL,
       CASE WHEN j.status = 'failed' THEN 'generation_failed' ELSE 'generation_succeeded' END,
       NULL,
       jsonb_build_object('job_id', j.id, 'model', j.model, 'error', j.error_message,
                          'error_category', j.failure_category,
                          'duration_seconds', EXTRACT(EPOCH FROM (j.updated_at - j.created_at))::int),
       j.updated_at
FROM public.jobs j
WHERE j.status IN ('completed', 'failed')
ORDER BY created_at;
