-- Generation pipeline v2 + billing hardening
--
-- 1. jobs: provider/cost tracking columns + started_at (per-job margin), credits_used
--    default 0 (it is only ever set by the server when it actually charges).
-- 2. Security: browsers could
--      a) UPDATE their own profile row with no column restriction - i.e. set
--         credits / subscription_status to anything (RLS "Users can update own
--         profile" has no column filter);
--      b) INSERT jobs with arbitrary credits_used / status, which refund paths
--         trusted.
--    Guard triggers now pin server-owned columns for anon/authenticated
--    callers. Service-role and SECURITY DEFINER code is unaffected.
-- 3. start_job(): one atomic step that locks the job, deducts credits
--    (`credits >= n` in the UPDATE - no read-then-write race) and marks it
--    processing. Replaces consume_credit + separate status updates.
-- 4. refund_credit(): refunds exactly what was charged, never a default of 1.
-- 5. sweep_stuck_jobs(): fails+refunds jobs that were charged but never got a
--    provider task; fails abandoned pending jobs; wakes the edge sweep only
--    when a live task has gone quiet.
-- 6. credit_grants ledger + grant_credits_once(): idempotent Stripe credit
--    grants (one grant per invoice / checkout, however often Stripe retries).
-- 7. generation_economics / generation_margins_daily views.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists product_model       text,
  add column if not exists provider_model      text,
  add column if not exists provider_request    jsonb,
  add column if not exists provider_error      text,
  add column if not exists provider_credits    numeric(10,2),
  add column if not exists provider_cost_usd   numeric(10,4),
  add column if not exists provider_checked_at timestamptz,
  add column if not exists billing_tier        text,
  add column if not exists charged_at          timestamptz,
  add column if not exists started_at          timestamptz,
  add column if not exists completed_at        timestamptz;

alter table public.jobs alter column credits_used set default 0;

-- Pending jobs were never charged under the old code either (charging moved
-- them to processing) - clear the misleading default so a later failure can't
-- "refund" a credit that was never taken.
update public.jobs set credits_used = 0 where status = 'pending' and coalesce(credits_used, 0) <> 0;

create index if not exists idx_jobs_free_quota
  on public.jobs (user_id, created_at)
  where billing_tier = 'free_quota';

-- ---------------------------------------------------------------------------
-- 2. Guard triggers
-- ---------------------------------------------------------------------------
create or replace function public.jobs_guard_client_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- current_user is the PostgREST role for browser requests.
  if current_user in ('anon', 'authenticated') then
    new.created_at          := now();  -- quota windows + timeouts depend on it
    new.updated_at          := now();
    new.started_at          := null;
    new.status              := 'pending';
    new.credits_used        := 0;
    new.charged_at          := null;
    new.refunded_at         := null;
    new.task_id             := null;
    new.result_url          := null;
    new.cover_url           := null;
    new.error_message       := null;
    new.failure_category    := null;
    new.retry_count         := 0;
    new.used_pro_model      := false;
    new.billing_tier        := null;
    new.product_model       := null;
    new.provider_model      := null;
    new.provider_request    := null;
    new.provider_error      := null;
    new.provider_credits    := null;
    new.provider_cost_usd   := null;
    new.provider_checked_at := null;
    new.completed_at        := null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_guard_client_insert on public.jobs;
create trigger jobs_guard_client_insert
  before insert on public.jobs
  for each row execute function public.jobs_guard_client_insert();

create or replace function public.profiles_guard_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.id                   := old.id;
    new.email                := old.email;
    new.credits              := old.credits;
    new.stripe_customer_id   := old.stripe_customer_id;
    new.subscription_id      := old.subscription_id;
    new.subscription_status  := old.subscription_status;
    new.plan                 := old.plan;
    new.trial_end_at         := old.trial_end_at;
    new.total_generations    := old.total_generations;
    new.signup_ip            := old.signup_ip;
    new.email_reminders_sent := old.email_reminders_sent;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_client_update on public.profiles;
create trigger profiles_guard_client_update
  before update on public.profiles
  for each row execute function public.profiles_guard_client_update();

-- This AFTER INSERT trigger on jobs runs as the inserting (browser) role; it
-- must keep working now that total_generations is pinned for that role.
create or replace function public.increment_total_generations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set total_generations = total_generations + 1 where id = new.user_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. start_job
-- ---------------------------------------------------------------------------
create or replace function public.start_job(
  job_uuid           uuid,
  p_credits          integer,
  p_billing_tier     text,
  p_product_model    text,
  p_provider_model   text,
  p_provider_request jsonb default null,
  p_free_daily_limit integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid;
  v_status text;
begin
  if p_credits is null or p_credits < 0 then
    raise exception 'invalid credit amount %', p_credits;
  end if;

  select user_id, status into v_user, v_status
    from public.jobs where id = job_uuid
    for update;
  if not found then return 'not_found'; end if;
  if v_status <> 'pending' then return 'not_pending'; end if;

  -- Free daily quota, counted under a per-user lock so parallel requests
  -- can't all slip past the limit.
  if p_billing_tier = 'free_quota' and p_free_daily_limit is not null then
    perform pg_advisory_xact_lock(hashtextextended('free_quota:' || v_user::text, 0));
    if (select count(*) from public.jobs
         where user_id = v_user and billing_tier = 'free_quota' and status <> 'failed'
           and created_at > now() - interval '24 hours') >= p_free_daily_limit then
      return 'limit_reached';
    end if;
  end if;

  if p_credits > 0 then
    update public.profiles
       set credits = credits - p_credits, updated_at = now()
     where id = v_user and credits >= p_credits;
    if not found then return 'insufficient_credits'; end if;
  end if;

  update public.jobs
     set status           = 'processing',
         credits_used     = p_credits,
         charged_at       = case when p_credits > 0 then now() end,
         billing_tier     = p_billing_tier,
         product_model    = p_product_model,
         provider_model   = p_provider_model,
         provider_request = p_provider_request,
         used_pro_model   = (p_product_model = 'nano-banana-pro'),
         started_at       = now(),
         updated_at       = now()
   where id = job_uuid;

  return 'ok';
end;
$$;

revoke all on function public.start_job(uuid, integer, text, text, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.start_job(uuid, integer, text, text, text, jsonb, integer) to service_role;

-- consume_credit is no longer used by the pipeline; kept (now race-free) for
-- any external caller.
create or replace function public.consume_credit(user_uuid uuid, credit_amount integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if credit_amount is null or credit_amount < 0 then return false; end if;
  update public.profiles
     set credits = credits - credit_amount, updated_at = now()
   where id = user_uuid and credits >= credit_amount;
  if not found then return false; end if;
  insert into public.usage_events (user_id, event_type, credits_consumed, metadata)
  values (user_uuid, 'generation', credit_amount, '{"type":"generation"}'::jsonb);
  return true;
end;
$$;
revoke all on function public.consume_credit(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. refund_credit - exactly what was charged
-- ---------------------------------------------------------------------------
create or replace function public.refund_credit(job_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid;
  v_amount integer;
begin
  select user_id, coalesce(credits_used, 0) into v_user, v_amount
    from public.jobs
   where id = job_uuid and status = 'failed' and refunded_at is null
   for update;
  if not found then return false; end if;

  update public.jobs set refunded_at = now() where id = job_uuid;
  if v_amount <= 0 then return false; end if;

  update public.profiles set credits = credits + v_amount, updated_at = now() where id = v_user;
  insert into public.usage_events (user_id, event_type, credits_consumed, metadata, job_id)
  values (v_user, 'refund', -v_amount, jsonb_build_object('reason', 'generation_failed'), job_uuid);
  return true;
end;
$$;
revoke all on function public.refund_credit(uuid) from public, anon, authenticated;
grant execute on function public.refund_credit(uuid) to service_role;

-- Fail + refund in ONE transaction (no window where a job is failed but not
-- refunded). Only acts on non-terminal jobs; optional extra conditions let
-- callers say "only if still pending" / "only if no provider task exists".
create or replace function public.fail_job(
  job_uuid               uuid,
  p_message              text,
  p_category             text,
  p_provider_error       text    default null,
  p_require_status       text    default null,
  p_require_no_task      boolean default false,
  p_provider_credits     numeric default null,
  p_provider_cost_usd    numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
     set status            = 'failed',
         error_message     = p_message,
         failure_category  = p_category,
         provider_error    = left(p_provider_error, 1000),
         provider_credits  = coalesce(p_provider_credits, provider_credits),
         provider_cost_usd = coalesce(p_provider_cost_usd, provider_cost_usd),
         updated_at        = now()
   where id = job_uuid
     and status in ('pending', 'processing')
     and (p_require_status is null or status = p_require_status)
     and (not p_require_no_task or task_id is null);
  if not found then return false; end if;
  perform public.refund_credit(job_uuid);
  return true;
end;
$$;
revoke all on function public.fail_job(uuid, text, text, text, text, boolean, numeric, numeric) from public, anon, authenticated;
grant execute on function public.fail_job(uuid, text, text, text, text, boolean, numeric, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- 5. sweep_stuck_jobs
-- ---------------------------------------------------------------------------
create or replace function public.sweep_stuck_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_abandoned int := 0;
  v_orphaned  int := 0;
  v_stale     int := 0;
  v_refunded  int := 0;
  v_request   bigint := null;
  r record;
begin
  -- Browser created the job but never called generate (tab closed). Nothing
  -- was charged.
  with failed as (
    update public.jobs
       set status = 'failed',
           error_message = 'Generation was not started. Please try again.',
           failure_category = 'abandoned',
           updated_at = now()
     where status = 'pending'
       and created_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*) into v_abandoned from failed;

  -- Charged, but the provider task was never created (crash between the two).
  for r in
    update public.jobs
       set status = 'failed',
           error_message = 'Generation failed to start — no credits were used. Please try again.',
           failure_category = 'unknown',
           updated_at = now()
     where status = 'processing'
       and task_id is null
       and updated_at < now() - interval '3 minutes'
    returning id
  loop
    perform public.refund_credit(r.id);
    v_orphaned := v_orphaned + 1;
  end loop;

  -- Safety net: any charged, failed, unrefunded job (should never exist now
  -- that fail_job is atomic, but legacy paths and crashes are covered).
  for r in
    select id from public.jobs
     where status = 'failed' and refunded_at is null
       and charged_at is not null and coalesce(credits_used, 0) > 0
  loop
    if public.refund_credit(r.id) then v_refunded := v_refunded + 1; end if;
  end loop;

  -- Live tasks nobody (callback / browser) has touched for a while: only
  -- now spend an HTTP request on the edge sweep.
  select count(*) into v_stale
    from public.jobs
   where status = 'processing'
     and task_id is not null
     and updated_at < now() - interval '2 minutes';

  if v_stale > 0 then
    select net.http_post(
      url     := 'https://cqnaooicfxqtnbuwsopu.supabase.co/functions/v1/sweep-stuck-jobs',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) into v_request;
  end if;

  return jsonb_build_object('abandoned_failed', v_abandoned, 'orphaned_refunded', v_orphaned, 'late_refunds', v_refunded,
                            'stale_found', v_stale, 'http_request_id', v_request);
end;
$$;
revoke all on function public.sweep_stuck_jobs() from public, anon, authenticated;

-- (the pg_cron schedule 'sweep_stuck_jobs_sql' from 20261011_lean_job_sweep
-- already calls this function every 5 minutes)

-- ---------------------------------------------------------------------------
-- 6. Idempotent credit grants (Stripe)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_grants (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     integer not null,
  reason     text not null,
  source_ref text not null unique,
  created_at timestamptz not null default now()
);
alter table public.credit_grants enable row level security;
create index if not exists idx_credit_grants_user on public.credit_grants (user_id, created_at desc);

-- p_mode 'add' adds to the balance; 'set_min' raises the balance to at least
-- p_amount (used for trials, which grant "200 credits", not "+200").
create or replace function public.grant_credits_once(
  p_user   uuid,
  p_amount integer,
  p_reason text,
  p_ref    text,
  p_mode   text default 'add'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer;
begin
  if p_amount is null or p_amount <= 0 then return false; end if;

  insert into public.credit_grants (user_id, amount, reason, source_ref)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict (source_ref) do nothing;
  if not found then return false; end if; -- already granted for this ref

  if p_mode = 'set_min' then
    select greatest(p_amount - credits, 0) into v_added from public.profiles where id = p_user for update;
  else
    v_added := p_amount;
  end if;
  update public.profiles set credits = credits + coalesce(v_added, 0), updated_at = now() where id = p_user;

  if coalesce(v_added, 0) > 0 then
    insert into public.usage_events (user_id, event_type, credits_consumed, metadata)
    values (p_user, 'purchase', -v_added, jsonb_build_object('reason', p_reason, 'ref', p_ref));
  end if;
  return true;
end;
$$;
revoke all on function public.grant_credits_once(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_credits_once(uuid, integer, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Economics views (service role / SQL editor only)
-- ---------------------------------------------------------------------------
-- Net revenue per credit after Stripe fees on the Pro plan:
-- (19.99 * 0.971 - 0.30) / 200 = 0.0955. Change here if plans change
-- (mirrors NET_REVENUE_USD_PER_CREDIT in supabase/functions/_shared/catalog.ts).
create or replace function public.net_revenue_per_credit()
returns numeric
language sql
immutable
as $$ select 0.0955::numeric $$;

create or replace view public.generation_economics
with (security_invoker = true) as
select
  j.id,
  j.created_at,
  j.user_id,
  j.result_type,
  j.product_model,
  j.provider_model,
  j.billing_tier,
  j.status,
  case when j.status = 'completed' then coalesce(j.credits_used, 0) else 0 end as credits_billed,
  j.provider_credits,
  coalesce(j.provider_cost_usd, 0) as provider_cost_usd,
  round(case when j.status = 'completed' then coalesce(j.credits_used, 0) else 0 end * public.net_revenue_per_credit(), 4) as est_revenue_usd,
  round(case when j.status = 'completed' then coalesce(j.credits_used, 0) else 0 end * public.net_revenue_per_credit()
        - coalesce(j.provider_cost_usd, 0), 4) as est_margin_usd,
  extract(epoch from (j.completed_at - j.created_at))::int as seconds_to_complete
from public.jobs j
where j.product_model is not null;

create or replace view public.generation_margins_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as day,
  product_model,
  billing_tier,
  count(*)                                    as jobs,
  count(*) filter (where status = 'completed') as completed,
  count(*) filter (where status = 'failed')    as failed,
  sum(credits_billed)                          as credits_billed,
  round(sum(est_revenue_usd), 2)               as est_revenue_usd,
  round(sum(provider_cost_usd), 2)             as provider_cost_usd,
  round(sum(est_margin_usd), 2)                as est_margin_usd,
  case when sum(est_revenue_usd) > 0
       then round(100 * sum(est_margin_usd) / sum(est_revenue_usd), 1) end as margin_pct,
  percentile_cont(0.5) within group (order by seconds_to_complete) as median_seconds
from public.generation_economics
group by 1, 2, 3;

revoke all on public.generation_economics, public.generation_margins_daily from anon, authenticated;
