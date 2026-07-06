# First-Party Analytics

Full user-journey tracking stored in your own Supabase — from landing, scroll depth
and time-on-site, through signup, upload, generation, paywall, checkout, to purchase.

## Setup (one-time)

1. **Run the migration**: open the Supabase SQL editor for project `cqnaooicfxqtnbuwsopu`
   and paste the contents of [supabase/migrations/20260704_add_analytics.sql](supabase/migrations/20260704_add_analytics.sql).
2. **Env var**: `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel (it already is — the
   Stripe webhook uses it).
3. Deploy. That's it — tracking starts immediately for every visitor.

## What gets tracked

### Automatic (every visitor, no code needed)
| Event | Detail |
|---|---|
| `page_view` | every route change |
| `scroll_depth` | 25 / 50 / 75 / 100% milestones per page |
| `page_left` | seconds on page + max scroll when tab closes/hides |
| `ping` | every 30s while visible → accurate session duration |

### Session row (analytics_sessions)
One row per 30-min session: landing page, referrer, **UTM parameters, fbclid/ttclid**
(so you can tie journeys to specific Meta/TikTok ads), device / browser / OS / country,
total duration, page count, max landing-page scroll depth.

### Funnel events (wired into the app)
| Event | Fires |
|---|---|
| `signup_completed` | email + Google OAuth signup |
| `image_uploaded` | all 4 upload paths (chat, generator hub, form) |
| `generation_started/completed/failed` | derived from the `jobs` table in the `user_journey` view — no client code, always accurate |
| `result_downloaded` | every download button (image / video / music) |
| `paywall_viewed` | ProUpsell / ProTrial / ProDiscount modal shown |
| `upgrade_button_clicked` | any upgrade CTA |
| `checkout_started` | Stripe checkout opened |
| `payment_info_added` | payment info step |
| `trial_started` | **server-side from Stripe webhook** (source of truth) |
| `payment_completed` | **server-side from Stripe webhook** (source of truth) |

### Identity
- `anonymous_id` (persistent per browser) links pre-signup browsing to the account
  after signup — you can see the ad click → landing → scroll → signup path per user.
- `user_id` is taken from the auth cookie server-side (never trusted from the client).

## How to read it (SQL editor)

**The funnel (last 30 days):**
```sql
SELECT * FROM funnel_overview;
```

**Every session with milestones (who scrolled how far, stayed how long, converted):**
```sql
SELECT * FROM session_overview ORDER BY landed_at DESC LIMIT 100;
```

**One user's full journey, step by step:**
```sql
SELECT event_name, page, properties, created_at
FROM user_journey
WHERE user_id = (SELECT id FROM profiles WHERE email = 'someone@example.com')
ORDER BY created_at;
```

**An anonymous visitor's journey (pre-signup):**
```sql
SELECT event_name, page, properties, created_at
FROM analytics_events
WHERE anonymous_id = '<uuid>'
ORDER BY created_at;
```

**Landing-page scroll-depth distribution:**
```sql
SELECT max_scroll_depth, COUNT(*)
FROM analytics_sessions
WHERE landing_page = '/'
GROUP BY 1 ORDER BY 1;
```

**Average time on site by traffic source:**
```sql
SELECT COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'meta_ad'
                                 WHEN ttclid IS NOT NULL THEN 'tiktok_ad'
                                 ELSE 'organic/direct' END) AS source,
       COUNT(*) AS sessions,
       ROUND(AVG(duration_seconds)) AS avg_seconds,
       ROUND(AVG(max_scroll_depth)) AS avg_scroll_pct
FROM analytics_sessions
GROUP BY 1 ORDER BY sessions DESC;
```

**Where paying users came from:**
```sql
SELECT s.utm_source, s.utm_campaign, s.landing_page, p.email, e.properties->>'amount' AS amount
FROM analytics_events e
JOIN analytics_sessions s ON s.user_id = e.user_id
JOIN profiles p ON p.id = e.user_id
WHERE e.event_name = 'payment_completed';
```

**Blog post performance — is Google/AI answer engines actually sending traffic:**
```sql
-- One row per post: total sessions, how many from Google organic,
-- how many from an AI answer engine (ChatGPT/Perplexity/Claude/Gemini), signups
SELECT * FROM blog_post_summary;

-- Same data broken out by referrer_category per post
SELECT * FROM blog_post_performance WHERE landing_page = '/blog/<slug>';
```
`referrer_category` buckets: `google`, `chatgpt`, `perplexity`, `claude`, `gemini`,
`bing`, `facebook`, `instagram`, `tiktok`, `reddit`, `youtube`, `direct`, or the raw
hostname for anything else.

## Notes

- Tables are **RLS-locked with zero policies** — only the service role (the
  `/api/track` route and Stripe webhook) can touch them. The views are also revoked
  from `anon`/`authenticated`.
- `ping` events keep session duration accurate; the `user_journey` view filters them out.
- This is first-party analytics (no data leaves your infrastructure). It runs
  regardless of the marketing-cookie banner choice; if you want to gate it on
  consent, add a check in `src/lib/analytics.ts` `track()`.
- Events are batched client-side and flushed every 5s (immediately for conversion
  events, and via `sendBeacon` on tab close so nothing is lost).
