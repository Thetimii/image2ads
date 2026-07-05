-- Adds visibility into abandoned checkouts (Stripe cancel_url returns with
-- ?checkout=cancelled, tracked as the 'checkout_cancelled' event).
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
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'checkout_cancelled') AS cancelled_checkout,
    EXISTS (SELECT 1 FROM public.analytics_events e WHERE e.session_id = s.id AND e.event_name = 'payment_completed') AS purchased
FROM public.analytics_sessions s
LEFT JOIN public.profiles p ON p.id = s.user_id;

REVOKE ALL ON public.session_overview FROM PUBLIC, anon, authenticated;

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
    UNION ALL SELECT 8, 'checkout_cancelled', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'checkout_cancelled'
    UNION ALL SELECT 9, 'payment_completed', COUNT(DISTINCT person_id) FROM people WHERE event_name = 'payment_completed'
) f
ORDER BY step;

REVOKE ALL ON public.funnel_overview FROM PUBLIC, anon, authenticated;
