-- ============================================================
-- Analytics: sessions + events + journey views
-- Captures the full user journey: landing -> scroll -> pages ->
-- signup -> upload -> generation -> paywall -> checkout -> purchase
-- Written by the server only (service role via /api/track).
-- ============================================================

-- 1. Sessions: one row per browser session (30 min inactivity window)
CREATE TABLE IF NOT EXISTS public.analytics_sessions (
    id UUID PRIMARY KEY,                          -- client-generated session id
    anonymous_id UUID NOT NULL,                   -- persistent per-browser id (pre-signup identity)
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    landed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER NOT NULL DEFAULT 0,  -- last_seen - landed, kept updated on ingest
    landing_page TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    fbclid TEXT,                                  -- Meta ad click id (present = came from FB/IG ad)
    ttclid TEXT,                                  -- TikTok ad click id
    device_type TEXT,                             -- mobile | tablet | desktop
    browser TEXT,
    os TEXT,
    country TEXT,                                 -- from Vercel geo header
    user_agent TEXT,
    max_scroll_depth INTEGER NOT NULL DEFAULT 0,  -- deepest scroll % on landing page
    page_count INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_anonymous_id ON public.analytics_sessions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id ON public.analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_landed_at ON public.analytics_sessions(landed_at);

-- 2. Events: every tracked action
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,                              -- no FK: events may arrive before/without session row
    anonymous_id UUID NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,                     -- e.g. page_view, scroll_depth, signup_completed,
                                                  -- image_uploaded, generation_started, paywall_viewed,
                                                  -- checkout_started, payment_completed ...
    page TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_anonymous_id ON public.analytics_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON public.analytics_events(event_name, created_at);

-- 3. Lock both tables down: no client access at all.
--    Only the service role (used by /api/track and the Stripe webhook) can read/write.
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- 4. Ingest function: one round-trip per batch from /api/track.
--    Upserts the session (incrementing counters) and inserts the events.
--    When a user_id is known, back-links all earlier anonymous activity.
CREATE OR REPLACE FUNCTION public.ingest_analytics(p_session JSONB, p_events JSONB)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := NULLIF(p_session->>'user_id', '')::uuid;
    v_anonymous_id UUID := (p_session->>'anonymous_id')::uuid;
    v_event_count INTEGER := COALESCE(jsonb_array_length(p_events), 0);
BEGIN
    INSERT INTO public.analytics_sessions (
        id, anonymous_id, user_id, landing_page, referrer,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        fbclid, ttclid, device_type, browser, os, country, user_agent,
        max_scroll_depth, page_count, event_count
    ) VALUES (
        (p_session->>'id')::uuid,
        v_anonymous_id,
        v_user_id,
        p_session->>'landing_page',
        p_session->>'referrer',
        p_session->>'utm_source', p_session->>'utm_medium', p_session->>'utm_campaign',
        p_session->>'utm_term', p_session->>'utm_content',
        p_session->>'fbclid', p_session->>'ttclid',
        p_session->>'device_type', p_session->>'browser', p_session->>'os',
        p_session->>'country', p_session->>'user_agent',
        COALESCE((p_session->>'scroll_depth')::int, 0),
        COALESCE((p_session->>'new_pages')::int, 0),
        v_event_count
    )
    ON CONFLICT (id) DO UPDATE SET
        last_seen_at = NOW(),
        duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - analytics_sessions.landed_at)))::int,
        user_id = COALESCE(analytics_sessions.user_id, EXCLUDED.user_id),
        max_scroll_depth = GREATEST(analytics_sessions.max_scroll_depth, EXCLUDED.max_scroll_depth),
        page_count = analytics_sessions.page_count + COALESCE((p_session->>'new_pages')::int, 0),
        event_count = analytics_sessions.event_count + v_event_count;

    INSERT INTO public.analytics_events (session_id, anonymous_id, user_id, event_name, page, properties, created_at)
    SELECT
        (p_session->>'id')::uuid,
        v_anonymous_id,
        v_user_id,
        e->>'event_name',
        e->>'page',
        COALESCE(e->'properties', '{}'::jsonb),
        COALESCE(NULLIF(e->>'created_at', '')::timestamptz, NOW())
    FROM jsonb_array_elements(p_events) AS e
    WHERE e->>'event_name' IS NOT NULL;

    -- Link pre-signup anonymous activity to the user once they are known
    IF v_user_id IS NOT NULL THEN
        UPDATE public.analytics_sessions
        SET user_id = v_user_id
        WHERE anonymous_id = v_anonymous_id AND user_id IS NULL;

        UPDATE public.analytics_events
        SET user_id = v_user_id
        WHERE anonymous_id = v_anonymous_id AND user_id IS NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.ingest_analytics(JSONB, JSONB) FROM PUBLIC, anon, authenticated;

-- 5. Server-side event helper (Stripe webhook: payment_completed etc.)
CREATE OR REPLACE FUNCTION public.track_server_event(
    p_user_id UUID,
    p_event_name TEXT,
    p_properties JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.analytics_events (anonymous_id, user_id, event_name, properties)
    VALUES (
        -- reuse the user's latest known anonymous_id so journeys stay linked
        COALESCE(
            (SELECT anonymous_id FROM public.analytics_sessions
             WHERE user_id = p_user_id ORDER BY last_seen_at DESC LIMIT 1),
            gen_random_uuid()
        ),
        p_user_id, p_event_name, COALESCE(p_properties, '{}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.track_server_event(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Views for reading the journey (query these in the SQL editor)
-- ============================================================

-- Full chronological journey per person, including generation
-- lifecycle pulled from the jobs table (no client tracking needed).
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
       CASE WHEN j.status = 'failed' THEN 'generation_failed' ELSE 'generation_completed' END,
       NULL,
       jsonb_build_object('job_id', j.id, 'model', j.model, 'error', j.error_message,
                          'duration_seconds', EXTRACT(EPOCH FROM (j.updated_at - j.created_at))::int),
       j.updated_at
FROM public.jobs j
WHERE j.status IN ('completed', 'failed')
ORDER BY created_at;

-- One row per session with its key journey milestones
CREATE OR REPLACE VIEW public.session_overview AS
SELECT
    s.id AS session_id,
    s.user_id,
    p.email,
    s.anonymous_id,
    s.landed_at,
    s.duration_seconds,
    s.landing_page,
    s.referrer,
    s.utm_source,
    s.utm_campaign,
    (s.fbclid IS NOT NULL) AS from_meta_ad,
    (s.ttclid IS NOT NULL) AS from_tiktok_ad,
    s.device_type,
    s.browser,
    s.country,
    s.max_scroll_depth,
    s.page_count,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'signup_completed') AS signed_up,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'image_uploaded') AS uploaded,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'paywall_viewed') AS saw_paywall,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'checkout_started') AS started_checkout,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'payment_completed') AS purchased
FROM public.analytics_sessions s
LEFT JOIN public.profiles p ON p.id = s.user_id;

-- Funnel: how many distinct people reached each step (last 30 days)
CREATE OR REPLACE VIEW public.funnel_overview AS
WITH people AS (
    SELECT COALESCE(user_id::text, anonymous_id::text) AS person_id, event_name
    FROM public.analytics_events
    WHERE created_at > NOW() - INTERVAL '30 days'
)
SELECT step, event_name, count FROM (
    SELECT 1 AS step, 'visited' AS event_name, COUNT(DISTINCT person_id) AS count FROM people
    UNION ALL SELECT 2, 'signup_completed', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'signup_completed'
    UNION ALL SELECT 3, 'image_uploaded', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'image_uploaded'
    UNION ALL SELECT 4, 'generation_started', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'generation_started'
    UNION ALL SELECT 5, 'result_downloaded', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'result_downloaded'
    UNION ALL SELECT 6, 'paywall_viewed', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'paywall_viewed'
    UNION ALL SELECT 7, 'checkout_started', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'checkout_started'
    UNION ALL SELECT 8, 'payment_completed', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'payment_completed'
) f
ORDER BY step;

-- Views are for the dashboard/SQL editor only — never client-readable
REVOKE ALL ON public.user_journey FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.session_overview FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.funnel_overview FROM PUBLIC, anon, authenticated;
