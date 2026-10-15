-- Pricing v2 (Oct 2026): anyone who has ever paid (subscription or one-time
-- credit pack) keeps paid-quality generations (2K, no watermark, video/pro
-- models) for the credits they hold, even without an active subscription.
alter table public.profiles add column if not exists has_paid boolean not null default false;

-- Backfill: current or former subscribers.
update public.profiles
   set has_paid = true
 where has_paid = false
   and subscription_status in ('active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid');

-- ...and anyone with a paid credit grant on record.
update public.profiles p
   set has_paid = true
 where p.has_paid = false
   and exists (
     select 1 from public.credit_grants g
      where g.user_id = p.id
        and (g.reason like 'credit_pack:%' or g.reason like 'subscription_start:%'
             or g.reason = 'subscription_renewal' or g.reason like 'upgrade:%')
   );

-- Users must not be able to grant themselves paid status: pin has_paid in
-- the existing client-update guard (same list as before + has_paid).
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
    new.free_quota_blocked   := old.free_quota_blocked;
    new.free_credits_refilled_on := old.free_credits_refilled_on;
    new.pro_discount_expires_at := old.pro_discount_expires_at;
    new.signup_checked_at    := old.signup_checked_at;
    new.has_paid             := old.has_paid;
  end if;
  return new;
end;
$$;

-- Refund / chargeback clawback (Stripe webhook). Idempotent per charge via
-- the credit_grants ledger (negative amount, unique source_ref), and atomic
-- (no read-modify-write race with start_job). Never takes the balance below
-- zero. Clears has_paid only when the user has no other paid grants and no
-- active subscription.
create or replace function public.clawback_credits_once(
  p_user     uuid,
  p_amount   integer,
  p_ref      text,
  p_paid_refs text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_paid boolean;
begin
  insert into public.credit_grants (user_id, amount, reason, source_ref)
  values (p_user, -greatest(coalesce(p_amount, 0), 0), 'clawback', p_ref)
  on conflict (source_ref) do nothing;
  if not found then return false; end if; -- already clawed back

  if coalesce(p_amount, 0) > 0 then
    update public.profiles
       set credits = greatest(credits - p_amount, 0), updated_at = now()
     where id = p_user;
    insert into public.usage_events (user_id, event_type, credits_consumed, metadata)
    values (p_user, 'refund_clawback', p_amount, jsonb_build_object('ref', p_ref));

    select exists (
      select 1 from public.credit_grants g
       where g.user_id = p_user
         and g.amount > 0
         and not (g.source_ref = any(coalesce(p_paid_refs, '{}')))
         and (g.reason like 'credit_pack:%' or g.reason like 'subscription_start:%'
              or g.reason = 'subscription_renewal' or g.reason like 'upgrade:%')
    ) into v_other_paid;

    update public.profiles
       set has_paid = false
     where id = p_user
       and not v_other_paid
       and coalesce(subscription_status, 'free') not in ('active', 'trialing');
  end if;
  return true;
end;
$$;
revoke all on function public.clawback_credits_once(uuid, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.clawback_credits_once(uuid, integer, text, text[]) to service_role;
