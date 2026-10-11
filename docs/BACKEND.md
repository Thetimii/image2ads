# Generation backend

All AI generation runs on **kie.ai's unified Market API** (`POST /api/v1/jobs/createTask`, `GET /api/v1/jobs/recordInfo`), completed by **kie.ai callbacks**, on Supabase Edge Functions + Postgres.

## Models

| Product | kie.ai model | We charge | kie.ai cost | Margin |
|---|---|---|---|---|
| Image – Nano Banana (paid, 2K) | `nano-banana-2-1` | 1 credit | 6 cr = $0.030 | 69% |
| Image – Nano Banana (free plan, 1K) | `nano-banana-2-1` | 1 of the 3 free daily credits | 4 cr = $0.020 | – |
| Image – Nano Banana Pro 1K/2K | `nano-banana-pro` | 6 credits | 18 cr = $0.090 | 84% |
| Image – Nano Banana Pro 4K | `nano-banana-pro` | 6 credits | 24 cr = $0.120 | 79% |
| Video – Veo 3.1 Fast 720p 8s | `veo-3-1` (`input.model: veo3_fast`) | 8 credits | 60 cr = $0.300 | 61% |
| Music – Suno V6 (2 tracks) | `ai-music-api/generate` | 3 credits | 12 cr = $0.060 | 79% |

Revenue basis: $0.0955 net per credit (Pro plan, after Stripe 2.9% + $0.30). 1 kie.ai credit = $0.005. Prices verified against kie.ai/pricing on 2026-10-11.
`deno run supabase/scripts/margins.ts` prints this table from the code. **Everything above lives in one file: `supabase/functions/_shared/catalog.ts`.**

Live, per-job actuals (kie.ai's own `creditsConsumed` for every task):

```sql
select * from generation_margins_daily order by day desc;   -- per day / model / tier
select * from generation_economics order by created_at desc; -- per job
```

## Free plan

Non-subscribers get **3 free credits a day** = 3 standard images (1K). Credits are topped up to 3 (never lowered) once per UTC day, lazily: when a dashboard page loads (`refill_my_free_credits()`) and inside `start_job` before charging, so no cron is needed. Day one's 3 are the signup credits. Accounts flagged by the signup IP guard (4th+ account from one IP) never get refills. Worst case cost per free account: **$0.06/day**. The value lives in SQL `public.free_daily_credits()`.

Subscribers' credits are sold (revenue); free-plan credits are not, so `generation_economics` counts revenue only for `billing_tier = 'subscription'`.

## Flow

```
browser ──insert jobs (pending)──▶ Postgres
browser ──POST /generate {jobId, model, resolution}──▶ generate
            price (catalog.ts) → start_job() [atomic: lock job, deduct credits, → processing]
            → kie.ai createTask(callBackUrl = kie-callback?job=…&sig=HMAC)
kie.ai ──POST callback──▶ kie-callback ── verify signature, 200 immediately,
            waitUntil(syncJob) → recordInfo → download → Storage → jobs.completed
browser ◀── Supabase Realtime (jobs UPDATE)  +  check-job-status poll (DB read; kie.ai at most every 10 s)
pg_cron (5 min, pure SQL) → sweep_stuck_jobs(): fail+refund orphans; wake sweep-stuck-jobs edge fn only if a live task went quiet
```

Guarantees:

- **One finisher.** Only `syncJob()` completes/fails jobs, always from kie.ai's API (callback bodies are never trusted). Every terminal write is `UPDATE … WHERE status = 'processing'`, so callback + poll + sweep racing can't double-complete, double-refund or double-log. Storage keys are deterministic (`<user>/<mode>/<jobId>.<ext>`).
- **Never charged for nothing.** Credits are deducted in the same transaction that starts the job. Any failure – kie.ai rejection, safety filter, timeout (15 min image/music, 30 min video), crash before the task exists – refunds exactly `credits_used`.
- **Idempotent start.** Double-clicks / client retries on a non-pending job just return its state.
- **Safety-filter retry.** Image jobs blocked by the content filter are retried once with a softened prompt at no extra charge.
- **Callback auth.** Either kie.ai's HMAC headers (`KIE_WEBHOOK_HMAC_KEY`) or our per-job signed `?sig=` token; anything else gets 401.

## Known, accepted limits

- If kie.ai's `createTask` times out (20 s) we refund the user, but kie.ai may still have accepted and billed that task. Rare; the cost is one render.
- `sweep-stuck-jobs` accepts calls without a secret (pg_net has none to send). Abuse is bounded: it only re-checks already-stale jobs, at most once per job per minute.
- Upgrade credits: at most one upgrade grant per subscription per billing period (difference between plans).

## Edge functions

| Function | Purpose |
|---|---|
| `generate` | Start a generation (all modes). Legacy names `generate-text-image`, `generate-image-image`, `generate-text-video`, `generate-image-video`, `generate-text-music`, `generate-*-free`, `run-job` are aliases kept for already-open tabs; delete once their logs are quiet. |
| `check-job-status` | Poll status. Cheap DB read; re-checks kie.ai at most every 10 s per job. |
| `kie-callback` | kie.ai webhook. |
| `sweep-stuck-jobs` | Backstop, only invoked by `sweep_stuck_jobs()` when needed. |

Shared code: `supabase/functions/_shared/` – `catalog.ts` (models + prices), `kie.ts` (API client + result parsing), `pipeline.ts` (start / sync / fail / refund), `signing.ts` (callback auth), `auth.ts`, `errors.ts`, `http.ts`.

## Secrets

| Where | Name | |
|---|---|---|
| Supabase functions | `KIE_API_KEY` | kie.ai API key |
| Supabase functions + Vercel | `INTERNAL_FUNCTION_SECRET` | server-to-server calls; signs callback URLs |
| Supabase functions | `KIE_WEBHOOK_HMAC_KEY` | optional, recommended: kie.ai/settings → Webhook HMAC |

## Tests

```bash
deno test --no-lock -A supabase/functions/_shared/backend_test.ts      # kie.ai parsing, signatures, pricing
# SQL (needs a local Postgres 15+):
createdb i2a_test
psql -d i2a_test -f supabase/tests/pg_harness_setup.sql
psql -d i2a_test -f supabase/migrations/20261012000000_generation_pipeline_v2.sql
psql -d i2a_test -f supabase/tests/pipeline_v2.test.sql                # prints PASS 1..8
```

## Deploy

```bash
# migration: production's migration history doesn't track this repo, so apply
# supabase/migrations/20261012000000_generation_pipeline_v2.sql directly
# (SQL editor or `supabase db query`), not via `db push`.
./supabase/deploy.sh        # runs tests, deploys functions, deletes retired ones
# then deploy the Next.js app (Vercel)
```
