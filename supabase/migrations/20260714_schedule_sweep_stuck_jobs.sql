-- Server-side safety net for the generation pipeline: jobs used to depend
-- entirely on the (broken) Kie.ai webhook or the client's browser tab
-- staying open and polling check-job-status. This cron runs independent of
-- both, every minute, calling sweep-stuck-jobs which re-triggers resolution
-- for any job that's gone quiet, and fails (without refunding) jobs that
-- never even got a task_id. sweep-stuck-jobs is deployed with
-- verify_jwt=false (pg_cron has no user session to authenticate with), so
-- no secret/key needs to be embedded in this migration.
select cron.schedule(
  'sweep-stuck-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cqnaooicfxqtnbuwsopu.supabase.co/functions/v1/sweep-stuck-jobs',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
