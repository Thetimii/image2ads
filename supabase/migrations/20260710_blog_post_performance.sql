-- Per-blog-post traffic breakdown: how many sessions landed on each post,
-- where they came from (google organic vs AI answer engines vs social vs
-- direct), and whether they converted. Mirrors the pattern in
-- session_overview but grouped by landing_page for the /blog/* paths only.
CREATE OR REPLACE VIEW public.blog_post_performance AS
SELECT
    s.landing_page,
    s.referrer_category,
    COUNT(*) AS sessions,
    ROUND(AVG(s.duration_seconds)) AS avg_seconds,
    ROUND(AVG(s.max_scroll_depth)) AS avg_scroll_pct,
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM public.analytics_events e
            WHERE e.session_id = s.id AND e.event_name = 'signup_completed'
        )
    ) AS signups
FROM public.analytics_sessions s
WHERE s.landing_page LIKE '/blog/%'
GROUP BY s.landing_page, s.referrer_category
ORDER BY s.landing_page, sessions DESC;

REVOKE ALL ON public.blog_post_performance FROM PUBLIC, anon, authenticated;

-- Same data collapsed to one row per post, so "is this post getting found
-- on Google at all" is a single glance instead of a GROUP BY.
CREATE OR REPLACE VIEW public.blog_post_summary AS
SELECT
    landing_page,
    SUM(sessions) AS total_sessions,
    SUM(sessions) FILTER (WHERE referrer_category = 'google') AS google_sessions,
    SUM(sessions) FILTER (WHERE referrer_category IN ('chatgpt', 'perplexity', 'claude', 'gemini')) AS ai_referral_sessions,
    SUM(signups) AS signups
FROM public.blog_post_performance
GROUP BY landing_page
ORDER BY total_sessions DESC;

REVOKE ALL ON public.blog_post_summary FROM PUBLIC, anon, authenticated;
