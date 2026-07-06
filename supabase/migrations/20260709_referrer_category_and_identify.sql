-- Adds a readable referrer bucket (google/chatgpt/facebook/instagram/tiktok/
-- direct/etc) alongside the raw referrer URL, computed client-side in
-- src/lib/analytics.ts and just persisted here.
ALTER TABLE public.analytics_sessions ADD COLUMN IF NOT EXISTS referrer_category TEXT;

CREATE OR REPLACE FUNCTION public.ingest_analytics(p_session JSONB, p_events JSONB)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := NULLIF(p_session->>'user_id', '')::uuid;
    v_anonymous_id UUID := (p_session->>'anonymous_id')::uuid;
    v_event_count INTEGER := COALESCE(jsonb_array_length(p_events), 0);
BEGIN
    INSERT INTO public.analytics_sessions (
        id, anonymous_id, user_id, landing_page, referrer, referrer_category,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        fbclid, ttclid, device_type, browser, os, country, user_agent,
        max_scroll_depth, page_count, event_count
    ) VALUES (
        (p_session->>'id')::uuid,
        v_anonymous_id,
        v_user_id,
        p_session->>'landing_page',
        p_session->>'referrer',
        p_session->>'referrer_category',
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

    -- Link pre-signup anonymous activity to the user once they are known.
    -- This is the backfill that now actually fires reliably: the client
    -- sends user_id as soon as it knows it (see identify() in analytics.ts),
    -- instead of only relying on the server reading a just-set auth cookie
    -- that hadn't always propagated yet.
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

-- Surface the bucketed referrer in the reporting views too.
-- CREATE OR REPLACE VIEW can only append new columns at the end - it can't
-- insert one in the middle (Postgres reads that as renaming every column
-- after it, hence the 42P16 error). Drop and recreate instead, with
-- referrer_category appended at the end rather than next to referrer.
DROP VIEW IF EXISTS public.session_overview;
CREATE VIEW public.session_overview AS
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
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'checkout_cancelled') AS cancelled_checkout,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'payment_completed') AS purchased,
    s.referrer_category
FROM public.analytics_sessions s
LEFT JOIN public.profiles p ON p.id = s.user_id;

REVOKE ALL ON public.session_overview FROM PUBLIC, anon, authenticated;

-- Quick source breakdown for signups specifically (this is the report the
-- "where did this signup actually come from" question keeps needing)
CREATE OR REPLACE VIEW public.signup_sources AS
SELECT
    p.id AS user_id,
    p.email,
    p.created_at AS signed_up_at,
    s.referrer_category,
    s.referrer,
    s.utm_source,
    s.utm_campaign,
    (s.fbclid IS NOT NULL) AS from_meta_ad,
    (s.ttclid IS NOT NULL) AS from_tiktok_ad,
    s.landing_page,
    s.device_type,
    s.country
FROM public.profiles p
LEFT JOIN public.analytics_sessions s ON s.user_id = p.id
ORDER BY p.created_at DESC;

REVOKE ALL ON public.signup_sources FROM PUBLIC, anon, authenticated;
