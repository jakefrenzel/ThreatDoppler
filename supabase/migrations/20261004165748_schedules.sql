-- Supabase Cron calls each edge function with the project's secret key. Both values live in Vault,
-- never in the repo. Create them once per project in the SQL editor:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('sb_secret_…', 'cron_secret_key');
-- Until they exist, the scheduled calls fail harmlessly (see cron.job_run_details).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Not granted to any API role: only the postgres role (which runs cron jobs) can call it, so
-- nobody can trigger ingestion from outside.
create function public.invoke_function(p_name text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
$$;

-- KEV updates through the US working day. EPSS publishes once a day, usually by 13:00 UTC; the
-- later run catches a late file and otherwise stops after reading the header. render-snapshot
-- recomputes scores before rendering.
select cron.schedule('ingest-kev', '7 * * * *', $$select public.invoke_function('ingest-kev')$$);
select cron.schedule('ingest-epss', '30 13,18 * * *', $$select public.invoke_function('ingest-epss')$$);
select cron.schedule('render-snapshot', '20 * * * *', $$select public.invoke_function('render-snapshot')$$);

-- Housekeeping: our run log and cron's own run history only matter for a few weeks.
select cron.schedule(
  'prune-logs',
  '45 3 * * *',
  $$
    delete from public.source_runs where started_at < now() - interval '90 days';
    delete from cron.job_run_details where end_time < now() - interval '14 days';
  $$
);
