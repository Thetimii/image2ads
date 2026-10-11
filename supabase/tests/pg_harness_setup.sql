-- Minimal stand-in for the Supabase environment + the pre-v2 production
-- schema, so supabase/migrations/20261011140000_generation_pipeline_v2.sql
-- can be applied and exercised against a plain local Postgres:
--   psql -f supabase/tests/pg_harness_setup.sql
--   psql -f supabase/migrations/20261011140000_generation_pipeline_v2.sql
--   psql -f supabase/tests/pipeline_v2.test.sql
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema net; create schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int) returns bigint language sql as $$ select 42::bigint $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table public.profiles (id uuid primary key, email text, full_name text, avatar_url text, credits integer default 3,
  stripe_customer_id text, subscription_id text, subscription_status text default 'free', created_at timestamptz default now(),
  updated_at timestamptz default now(), cookie_preferences jsonb, tutorial_completed boolean default false,
  pro_discount_expires_at timestamptz, trial_end_at timestamptz, plan text default 'free', total_generations integer default 0,
  email_reminders_sent jsonb default '{}', signup_ip inet, first_generation_completed_at timestamptz);
create table public.jobs (id uuid primary key default gen_random_uuid(), user_id uuid not null, image_id uuid, status text not null default 'pending',
  result_url text, error_message text, credits_used integer default 1, created_at timestamptz default now(), updated_at timestamptz default now(),
  image_ids uuid[] default '{}', prompt text default '', model text not null default 'gemini', custom_name text, result_image_id uuid,
  assets jsonb default '{}', style_preset text, has_images boolean not null default false, task_id text, result_type text default 'image',
  source_image_url text, music_options jsonb default '{}', lyrics text, cover_url text, aspect_ratio text default 'landscape',
  used_pro_model boolean not null default false, refunded_at timestamptz, retry_count integer not null default 0, failure_category text);
create table public.usage_events (id uuid primary key default gen_random_uuid(), user_id uuid, event_type text, credits_consumed integer,
  metadata jsonb, created_at timestamptz default now(), job_id uuid);

alter table public.profiles enable row level security; alter table public.jobs enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view own jobs" on public.jobs for select using (auth.uid() = user_id);
create policy "Users can insert own jobs" on public.jobs for insert with check (auth.uid() = user_id);

create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger update_jobs_updated_at before update on public.jobs for each row execute function public.update_updated_at_column();
create function public.increment_total_generations() returns trigger language plpgsql as $$
begin update profiles set total_generations = total_generations + 1 where id = new.user_id; return new; end $$;
create trigger trigger_increment_total_generations after insert on public.jobs for each row execute function public.increment_total_generations();
