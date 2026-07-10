-- consume_credit and add_credits are SECURITY DEFINER functions that were
-- never locked down the way refund_credit was in
-- 20260712_harden_refund_credit.sql - both are directly callable by anon
-- and authenticated roles via PostgREST (/rest/v1/rpc/consume_credit,
-- /rest/v1/rpc/add_credits) with a caller-supplied user_uuid and
-- credit_amount. Any signed-in (or even anonymous) caller could invoke
-- add_credits with an arbitrary huge amount for any user_uuid and mint
-- unlimited free credits, bypassing Stripe entirely. Every legitimate
-- caller is a service-role edge function, same as refund_credit - revoking
-- public execute has no effect on real usage.
revoke all on function public.consume_credit(uuid, integer) from public, anon, authenticated;
revoke all on function public.add_credits(uuid, integer) from public, anon, authenticated;
