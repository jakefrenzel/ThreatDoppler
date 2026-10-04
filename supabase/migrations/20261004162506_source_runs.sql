-- Nothing in public is reachable through the Data API unless a migration grants it. Supabase
-- applies this to existing projects from 2026-10-30; doing it here makes dev, prod and local agree
-- now. Every table and function below states its own grants.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions
  from anon, authenticated, service_role;
-- Postgres lets every role execute new functions through PUBLIC. That default is global, so it
-- can't be revoked per schema.
alter default privileges for role postgres
  revoke execute on functions from public;

-- One row per run of an ingest, compute or render job. Used to spot failing or stale sources and
-- to track the database size against the free tier's 500 MB.
create table public.source_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  rows_written integer,
  error text,
  db_size_bytes bigint
);

create index source_runs_source_started_at_idx on public.source_runs (source, started_at desc);

alter table public.source_runs enable row level security;

-- Only server-side jobs (the secret key) read and write runs. No policies, so anon and
-- authenticated would see nothing even if they were granted access.
grant select, insert, update, delete on public.source_runs to service_role;
