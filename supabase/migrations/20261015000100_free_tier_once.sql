-- Pricing v2 (Oct 2026): the free plan is 3 credits ONCE per account (was 3
-- every day, forever - light users never needed to pay). Downloads on the
-- free plan are watermarked (src/app/api/download-image).
create or replace function public.refill_free_credits(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before  integer;
  v_credits integer;
  v_today   date := (now() at time zone 'utc')::date;
begin
  select credits into v_before from public.profiles where id = p_user for update;
  if not found then return null; end if;

  update public.profiles
     set credits = greatest(credits, public.free_daily_credits()),
         free_credits_refilled_on = v_today,
         updated_at = now()
   where id = p_user
     and coalesce(subscription_status, 'free') not in ('active', 'trialing')
     and not has_paid
     and not free_quota_blocked
     -- the signup guard must have run (server-side, apply_signup_ip_guard)
     and signup_checked_at is not null
     -- one-time welcome credits: only if never granted before
     and free_credits_refilled_on is null
  returning credits into v_credits;

  if v_credits is null then return v_before; end if;
  if v_credits > v_before then
    insert into public.usage_events (user_id, event_type, credits_consumed, metadata)
    values (p_user, 'free_welcome_credits', -(v_credits - v_before), jsonb_build_object('day', v_today));
  end if;
  return v_credits;
end;
$$;
revoke all on function public.refill_free_credits(uuid) from public, anon, authenticated;
grant execute on function public.refill_free_credits(uuid) to service_role;
