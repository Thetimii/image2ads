-- Lean job sweep: replace the every-minute HTTP cron with a pure-SQL sweep.
--
-- Why: the old 'sweep-stuck-jobs' cron fired an edge function every minute,
-- which in turn made 2 REST calls - ~7,000 requests/day on a project with a
-- handful of real users, and the re-checks it triggered were all failing with
-- 401 anyway (wrong auth header). This migration:
--
--   1. removes the three legacy cron jobs:
--        - sweep-stuck-jobs (every minute, HTTP)
--        - two duplicate 'retarget-email-daily' HTTP jobs (02:00 and 10:00 UTC)
--          that both 401'd; the real trigger is Vercel's /api/cron/retarget-email
--          (vercel.json), which sends the correct x-internal-secret.
--   2. adds public.sweep_stuck_jobs(): fails orphaned jobs in SQL, and only
--      when a processing job with a task_id has gone quiet does it fire ONE
--      pg_net request to the sweep-stuck-jobs edge function. Idle = zero HTTP.
--   3. schedules that function every 5 minutes.
--   4. adds the indexes the pipeline actually queries on (task_id lookups
--      from the webhook, status/updated_at scans from the sweep).
--   5. purges cron.job_run_details (134k rows / 47 MB had accumulated) and
--      keeps it trimmed daily.

-- 1) Drop legacy cron jobs (by name where named, by command otherwise).
do $$
declare r record;
begin
  for r in
    select jobid from cron.job
    where jobname in ('sweep-stuck-jobs', 'sweep_stuck_jobs_sql', 'purge_cron_run_details')
       or command ilike '%/functions/v1/sweep-stuck-jobs%'
       or command ilike '%/functions/v1/retarget-email-daily%'
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

-- 4) Indexes (created before the function so the first run is already cheap).
create index if not exists idx_jobs_task_id on public.jobs (task_id) where task_id is not null;
create index if not exists idx_jobs_open_by_updated
  on public.jobs (status, updated_at)
  where status in ('pending', 'processing');

-- 2) Pure-SQL sweep.
create or replace function public.sweep_stuck_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_orphaned int := 0;
  v_stale    int := 0;
  v_request  bigint := null;
begin
  -- Orphans: never got a Kie task_id and are old enough that they never
  -- will. Not refunded (see the original sweep-stuck-jobs notes: a pending
  -- job never consumed a credit, and credits_used isn't reliable for the
  -- processing-without-task_id case).
  with failed as (
    update public.jobs
       set status = 'failed',
           error_message = 'Generation failed to start. Please try again.',
           failure_category = 'unknown',
           updated_at = now()
     where task_id is null
       and status in ('pending', 'processing')
       and created_at < now() - interval '3 minutes'
    returning 1
  )
  select count(*) into v_orphaned from failed;

  -- Stale: have a task_id but nobody (webhook / browser) has touched them
  -- for a while. Only then do we spend an HTTP request.
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
      timeout_milliseconds := 15000
    ) into v_request;
  end if;

  return jsonb_build_object(
    'orphaned_failed', v_orphaned,
    'stale_found', v_stale,
    'http_request_id', v_request
  );
end;
$$;

revoke all on function public.sweep_stuck_jobs() from public, anon, authenticated;

-- 3) Schedule: every 5 minutes, SQL only.
select cron.schedule('sweep_stuck_jobs_sql', '*/5 * * * *', $$select public.sweep_stuck_jobs();$$);

-- 5) Purge pg_cron history and keep it trimmed.
delete from cron.job_run_details where end_time < now() - interval '2 days';
select cron.schedule(
  'purge_cron_run_details',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '2 days';$$
);
