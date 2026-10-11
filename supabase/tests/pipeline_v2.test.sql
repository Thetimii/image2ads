-- Behavioural tests for 20261011140000_generation_pipeline_v2.sql.
-- Each block raises an exception on failure; prints PASS lines otherwise.
\set ON_ERROR_STOP 1
insert into profiles (id, email, credits, subscription_status) values
  ('11111111-1111-1111-1111-111111111111', 'a@x.com', 10, 'active'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.com', 3, 'free');

-- 1. A signed-in user cannot give themselves credits / a subscription.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
update profiles set credits = 999999, subscription_status = 'active', plan = 'business', full_name = 'Bob' where id = '22222222-2222-2222-2222-222222222222';
reset role;
do $$ begin
  if (select credits from profiles where id = '22222222-2222-2222-2222-222222222222') <> 3 then raise exception 'FAIL: user changed own credits'; end if;
  if (select subscription_status from profiles where id = '22222222-2222-2222-2222-222222222222') <> 'free' then raise exception 'FAIL: user changed own subscription'; end if;
  if (select full_name from profiles where id = '22222222-2222-2222-2222-222222222222') <> 'Bob' then raise exception 'FAIL: harmless column blocked'; end if;
  raise notice 'PASS 1 profile guard';
end $$;

-- 2. A signed-in user cannot insert a job with server-owned fields; total_generations still counts.
set role authenticated;
insert into jobs (id, user_id, status, credits_used, task_id, result_url, prompt)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'completed', 500, 'fake', 'x.png', 'hi');
reset role;
do $$ declare j jobs; begin
  select * into j from jobs where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if j.status <> 'pending' or j.credits_used <> 0 or j.task_id is not null or j.result_url is not null then raise exception 'FAIL: job insert guard %', row_to_json(j); end if;
  if (select total_generations from profiles where id = '22222222-2222-2222-2222-222222222222') <> 1 then raise exception 'FAIL: total_generations not incremented'; end if;
  raise notice 'PASS 2 job insert guard';
end $$;

-- 3. browser roles cannot call the money RPCs
do $$ begin
  if has_function_privilege('authenticated', 'public.start_job(uuid,integer,text,text,text,jsonb)', 'execute') then raise exception 'FAIL: start_job exposed'; end if;
  if has_function_privilege('authenticated', 'public.grant_credits_once(uuid,integer,text,text,text)', 'execute') then raise exception 'FAIL: grant exposed'; end if;
  if has_function_privilege('anon', 'public.refund_credit(uuid)', 'execute') then raise exception 'FAIL: refund exposed'; end if;
  if not has_function_privilege('service_role', 'public.start_job(uuid,integer,text,text,text,jsonb)', 'execute') then raise exception 'FAIL: service_role cannot start'; end if;
  raise notice 'PASS 3 rpc privileges';
end $$;

-- 4. start_job charges atomically, exactly once; insufficient credits leave balance alone.
insert into jobs (id, user_id, prompt) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'p'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'p'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'p');
do $$ declare r text; begin
  r := start_job('bbbbbbbb-0000-0000-0000-000000000001', 6, 'subscription', 'nano-banana-pro', 'nano-banana-pro', '{"model":"nano-banana-pro"}');
  if r <> 'ok' then raise exception 'FAIL: start %', r; end if;
  r := start_job('bbbbbbbb-0000-0000-0000-000000000001', 6, 'subscription', 'nano-banana-pro', 'nano-banana-pro', null);
  if r <> 'not_pending' then raise exception 'FAIL: double start %', r; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 4 then raise exception 'FAIL: balance after charge'; end if;
  r := start_job('bbbbbbbb-0000-0000-0000-000000000002', 8, 'subscription', 'veo-3.1-fast', 'veo-3-1', null);
  if r <> 'insufficient_credits' then raise exception 'FAIL: expected insufficient, got %', r; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 4 then raise exception 'FAIL: balance changed on insufficient'; end if;
  if (select status from jobs where id = 'bbbbbbbb-0000-0000-0000-000000000002') <> 'pending' then raise exception 'FAIL: job moved on insufficient'; end if;
  r := start_job('bbbbbbbb-0000-0000-0000-000000000003', 0, 'free_plan', 'nano-banana', 'nano-banana-2-1', null);
  if r <> 'ok' or (select charged_at from jobs where id = 'bbbbbbbb-0000-0000-0000-000000000003') is not null then raise exception 'FAIL: zero-credit start'; end if;
  if (select used_pro_model from jobs where id = 'bbbbbbbb-0000-0000-0000-000000000001') is not true then raise exception 'FAIL: used_pro_model'; end if;
  raise notice 'PASS 4 start_job';
end $$;

-- 5. refund returns exactly what was charged, once; free jobs refund nothing.
update jobs set status = 'failed' where id in ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003');
do $$ begin
  if not refund_credit('bbbbbbbb-0000-0000-0000-000000000001') then raise exception 'FAIL: refund returned false'; end if;
  if refund_credit('bbbbbbbb-0000-0000-0000-000000000001') then raise exception 'FAIL: double refund'; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 10 then raise exception 'FAIL: refund amount'; end if;
  if refund_credit('bbbbbbbb-0000-0000-0000-000000000003') then raise exception 'FAIL: refunded a free job'; end if;
  if (select credits from profiles where id = '22222222-2222-2222-2222-222222222222') <> 3 then raise exception 'FAIL: free refund changed balance'; end if;
  raise notice 'PASS 5 refund_credit';
end $$;

-- 6. sweep: abandoned pending -> failed (no refund); charged-without-task -> failed + refunded; live stale -> HTTP wake.
insert into jobs (id, user_id, prompt) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'abandoned'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'orphan'),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'stale');
select start_job('cccccccc-0000-0000-0000-000000000002', 1, 'subscription', 'nano-banana', 'nano-banana-2-1', null);
select start_job('cccccccc-0000-0000-0000-000000000003', 1, 'subscription', 'nano-banana', 'nano-banana-2-1', null);
alter table jobs disable trigger update_jobs_updated_at;
update jobs set created_at = now() - interval '20 minutes', updated_at = now() - interval '20 minutes' where id::text like 'cccccccc%';
update jobs set task_id = 'task-live' where id = 'cccccccc-0000-0000-0000-000000000003';
alter table jobs enable trigger update_jobs_updated_at;
do $$ declare res jsonb; begin
  res := sweep_stuck_jobs();
  if (res->>'abandoned_failed')::int <> 1 or (res->>'orphaned_refunded')::int <> 1 or (res->>'stale_found')::int <> 1 or res->>'http_request_id' is null then raise exception 'FAIL: sweep %', res; end if;
  if (select status from jobs where id = 'cccccccc-0000-0000-0000-000000000002') <> 'failed' then raise exception 'FAIL: orphan not failed'; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 9 then raise exception 'FAIL: orphan not refunded (balance %)', (select credits from profiles where id = '11111111-1111-1111-1111-111111111111'); end if;
  if (select status from jobs where id = 'cccccccc-0000-0000-0000-000000000003') <> 'processing' then raise exception 'FAIL: live job touched'; end if;
  raise notice 'PASS 6 sweep_stuck_jobs';
end $$;

-- 7. credit grants are idempotent per source ref; set_min for trials.
do $$ begin
  if not grant_credits_once('22222222-2222-2222-2222-222222222222', 200, 'subscription_renewal', 'invoice:in_1') then raise exception 'FAIL: first grant'; end if;
  if grant_credits_once('22222222-2222-2222-2222-222222222222', 200, 'subscription_renewal', 'invoice:in_1') then raise exception 'FAIL: duplicate grant'; end if;
  if (select credits from profiles where id = '22222222-2222-2222-2222-222222222222') <> 203 then raise exception 'FAIL: grant amount'; end if;
  perform grant_credits_once('22222222-2222-2222-2222-222222222222', 200, 'trial', 'trial:cs_1', 'set_min');
  if (select credits from profiles where id = '22222222-2222-2222-2222-222222222222') <> 203 then raise exception 'FAIL: set_min lowered/raised wrongly'; end if;
  raise notice 'PASS 7 grant_credits_once';
end $$;

-- 8. economics view
update jobs set status = 'completed', provider_cost_usd = 0.03, provider_credits = 6 where id = 'cccccccc-0000-0000-0000-000000000003';
do $$ declare m record; begin
  select * into m from generation_economics where id = 'cccccccc-0000-0000-0000-000000000003';
  if m.est_revenue_usd <> 0.0955 or m.est_margin_usd <> 0.0655 then raise exception 'FAIL: economics %', row_to_json(m); end if;
  perform 1 from generation_margins_daily;
  raise notice 'PASS 8 economics views';
end $$;

-- 9. browser can't backdate created_at (free-quota bypass)
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into jobs (id, user_id, prompt, created_at) values ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'p', now() - interval '3 days');
reset role;
do $$ begin
  if (select created_at from jobs where id = 'dddddddd-0000-0000-0000-000000000001') < now() - interval '1 minute' then raise exception 'FAIL: created_at backdated'; end if;
  raise notice 'PASS 9 created_at pinned';
end $$;

-- 10. free plan: 3 free credits a day, refilled once per UTC day
insert into profiles (id, email, credits, subscription_status, free_credits_refilled_on) values
  ('77777777-0000-0000-0000-000000000001', 'free@x.com', 0, 'free', current_date - 1),
  ('77777777-0000-0000-0000-000000000002', 'sub@x.com',  0, 'active', current_date - 1),
  ('77777777-0000-0000-0000-000000000003', 'rich@x.com', 50, null, current_date - 1);
insert into jobs (id, user_id, prompt) values
  ('eeeeeeee-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'q1'),
  ('eeeeeeee-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001', 'q2'),
  ('eeeeeeee-0000-0000-0000-000000000003', '77777777-0000-0000-0000-000000000001', 'q3'),
  ('eeeeeeee-0000-0000-0000-000000000004', '77777777-0000-0000-0000-000000000001', 'q4'),
  ('eeeeeeee-0000-0000-0000-000000000005', '77777777-0000-0000-0000-000000000002', 's1'),
  ('eeeeeeee-0000-0000-0000-000000000006', '99999999-0000-0000-0000-000000000004', 'abuser');
do $$ declare r text; i int; begin
  if free_daily_credits() <> 3 then raise exception 'FAIL: free_daily_credits must be 3 (matches catalog.ts)'; end if;
  -- free user at 0 credits, last refilled yesterday: gets exactly 3 images today
  for i in 1..3 loop
    r := start_job(('eeeeeeee-0000-0000-0000-00000000000' || i)::uuid, 1, 'free_plan', 'nano-banana', 'nano-banana-2-1', null);
    if r <> 'ok' then raise exception 'FAIL: free image % -> %', i, r; end if;
  end loop;
  r := start_job('eeeeeeee-0000-0000-0000-000000000004', 1, 'free_plan', 'nano-banana', 'nano-banana-2-1', null);
  if r <> 'insufficient_credits' then raise exception 'FAIL: 4th free image allowed (%)', r; end if;
  if (select credits from profiles where id = '77777777-0000-0000-0000-000000000001') <> 0 then raise exception 'FAIL: free balance'; end if;
  -- second refill the same day does nothing
  if refill_free_credits('77777777-0000-0000-0000-000000000001') <> 0 then raise exception 'FAIL: refilled twice in a day'; end if;
  -- subscribers never get free credits
  r := start_job('eeeeeeee-0000-0000-0000-000000000005', 1, 'subscription', 'nano-banana', 'nano-banana-2-1', null);
  if r <> 'insufficient_credits' then raise exception 'FAIL: subscriber got free credits (%)', r; end if;
  -- refill never lowers a balance
  if refill_free_credits('77777777-0000-0000-0000-000000000003') <> 50 then raise exception 'FAIL: refill lowered balance'; end if;
  -- next day: back to 3
  update profiles set free_credits_refilled_on = current_date - 1 where id = '77777777-0000-0000-0000-000000000001';
  if refill_free_credits('77777777-0000-0000-0000-000000000001') <> 3 then raise exception 'FAIL: next-day refill'; end if;
  -- IP-flagged account (backfilled by the migration) gets nothing
  if not (select free_quota_blocked from profiles where id = '99999999-0000-0000-0000-000000000004') then raise exception 'FAIL: backfill flag'; end if;
  if (select free_quota_blocked from profiles where id = '99999999-0000-0000-0000-000000000003') then raise exception 'FAIL: 3rd account wrongly flagged'; end if;
  r := start_job('eeeeeeee-0000-0000-0000-000000000006', 1, 'free_plan', 'nano-banana', 'nano-banana-2-1', null);
  if r <> 'insufficient_credits' then raise exception 'FAIL: flagged account generated (%)', r; end if;
  raise notice 'PASS 10 free plan daily credits';
end $$;

-- 10b. signup: 3 credits that count as today's refill; IP guard flags the 4th account
insert into auth.users (id, email) values ('88888888-0000-0000-0000-000000000001', 'new@x.com');
select apply_signup_ip_guard('88888888-0000-0000-0000-000000000001', '10.0.0.9');
insert into auth.users (id, email) values ('88888888-0000-0000-0000-000000000002', 'new2@x.com');
select apply_signup_ip_guard('88888888-0000-0000-0000-000000000002', '10.0.0.77');
do $$ declare p profiles; begin
  select * into p from profiles where id = '88888888-0000-0000-0000-000000000002';
  if p.credits <> 3 or p.free_credits_refilled_on <> (now() at time zone 'utc')::date or p.free_quota_blocked then raise exception 'FAIL: new signup %', row_to_json(p); end if;
  if refill_free_credits(p.id) <> 3 then raise exception 'FAIL: signup day double grant'; end if;
  select * into p from profiles where id = '88888888-0000-0000-0000-000000000001';
  if p.credits <> 0 or not p.free_quota_blocked then raise exception 'FAIL: ip guard %', row_to_json(p); end if;
  raise notice 'PASS 10b signup + IP guard';
end $$;

-- 10c. browser can refill only itself, can't flip the flags
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000003', false);
update profiles set free_quota_blocked = true, free_credits_refilled_on = null where id = '77777777-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', '99999999-0000-0000-0000-000000000004', false);
update profiles set free_quota_blocked = false where id = '99999999-0000-0000-0000-000000000004';
select refill_my_free_credits();
reset role;
do $$ begin
  if (select free_quota_blocked from profiles where id = '77777777-0000-0000-0000-000000000003') then raise exception 'FAIL: browser set flag'; end if;
  if not (select free_quota_blocked from profiles where id = '99999999-0000-0000-0000-000000000004') then raise exception 'FAIL: browser cleared flag'; end if;
  if (select credits from profiles where id = '99999999-0000-0000-0000-000000000004') <> 0 then raise exception 'FAIL: blocked refill via rpc'; end if;
  if has_function_privilege('anon', 'public.refill_my_free_credits()', 'execute') then raise exception 'FAIL: anon can refill'; end if;
  if has_function_privilege('authenticated', 'public.refill_free_credits(uuid)', 'execute') then raise exception 'FAIL: refill any user exposed'; end if;
  raise notice 'PASS 10c refill rpc security';
end $$;

-- 11. fail_job is atomic with refund, and respects its conditions
insert into jobs (id, user_id, prompt) values
  ('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f1'),
  ('ffffffff-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f2');
select start_job('ffffffff-0000-0000-0000-000000000001', 2, 'subscription', 'nano-banana', 'nano-banana-2-1', null);
select start_job('ffffffff-0000-0000-0000-000000000002', 2, 'subscription', 'nano-banana', 'nano-banana-2-1', null);
update jobs set task_id = 'live' where id = 'ffffffff-0000-0000-0000-000000000002';
do $$ declare before int; begin
  before := (select credits from profiles where id = '11111111-1111-1111-1111-111111111111');
  if fail_job('ffffffff-0000-0000-0000-000000000001', 'x', 'unknown', null, 'pending') then raise exception 'FAIL: require_status ignored'; end if;
  if fail_job('ffffffff-0000-0000-0000-000000000002', 'x', 'unknown', null, null, true) then raise exception 'FAIL: require_no_task ignored'; end if;
  if not fail_job('ffffffff-0000-0000-0000-000000000001', 'x', 'timeout', 'raw', null, false, 0, 0) then raise exception 'FAIL: fail_job'; end if;
  if fail_job('ffffffff-0000-0000-0000-000000000001', 'x', 'timeout') then raise exception 'FAIL: double fail'; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> before + 2 then raise exception 'FAIL: fail_job refund'; end if;
  if (select refunded_at from jobs where id = 'ffffffff-0000-0000-0000-000000000001') is null then raise exception 'FAIL: refunded_at'; end if;
  raise notice 'PASS 11 fail_job';
end $$;

-- 12. sweep refunds a failed-but-unrefunded charged job (safety net)
update jobs set status = 'failed' where id = 'ffffffff-0000-0000-0000-000000000002';
do $$ declare before int; res jsonb; begin
  before := (select credits from profiles where id = '11111111-1111-1111-1111-111111111111');
  res := sweep_stuck_jobs();
  if (res->>'late_refunds')::int < 1 or (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> before + 2 then raise exception 'FAIL: late refund %', res; end if;
  raise notice 'PASS 12 late refund safety net';
end $$;

-- 13. set_min only logs what it actually added
do $$ begin
  update profiles set credits = 150 where id = '11111111-1111-1111-1111-111111111111';
  perform grant_credits_once('11111111-1111-1111-1111-111111111111', 200, 'trial', 'trial:cs_2', 'set_min');
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 200 then raise exception 'FAIL: set_min result'; end if;
  if (select credits_consumed from usage_events where metadata->>'ref' = 'trial:cs_2') <> -50 then raise exception 'FAIL: set_min logged wrong amount'; end if;
  raise notice 'PASS 13 set_min ledger';
end $$;
