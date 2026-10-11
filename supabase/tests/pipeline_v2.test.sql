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
  r := start_job('bbbbbbbb-0000-0000-0000-000000000001', 6, 'credits', 'nano-banana-pro', 'nano-banana-pro', '{"model":"nano-banana-pro"}');
  if r <> 'ok' then raise exception 'FAIL: start %', r; end if;
  r := start_job('bbbbbbbb-0000-0000-0000-000000000001', 6, 'credits', 'nano-banana-pro', 'nano-banana-pro', null);
  if r <> 'not_pending' then raise exception 'FAIL: double start %', r; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 4 then raise exception 'FAIL: balance after charge'; end if;
  r := start_job('bbbbbbbb-0000-0000-0000-000000000002', 8, 'credits', 'veo-3.1-fast', 'veo-3-1', null);
  if r <> 'insufficient_credits' then raise exception 'FAIL: expected insufficient, got %', r; end if;
  if (select credits from profiles where id = '11111111-1111-1111-1111-111111111111') <> 4 then raise exception 'FAIL: balance changed on insufficient'; end if;
  if (select status from jobs where id = 'bbbbbbbb-0000-0000-0000-000000000002') <> 'pending' then raise exception 'FAIL: job moved on insufficient'; end if;
  r := start_job('bbbbbbbb-0000-0000-0000-000000000003', 0, 'free_quota', 'nano-banana', 'nano-banana-2-1', null);
  if r <> 'ok' or (select charged_at from jobs where id = 'bbbbbbbb-0000-0000-0000-000000000003') is not null then raise exception 'FAIL: free quota start'; end if;
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
select start_job('cccccccc-0000-0000-0000-000000000002', 1, 'credits', 'nano-banana', 'nano-banana-2-1', null);
select start_job('cccccccc-0000-0000-0000-000000000003', 1, 'credits', 'nano-banana', 'nano-banana-2-1', null);
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
