-- Problems with the pipeline, one row each; no rows means healthy. Run nightly by the Backup
-- workflow, which fails (and so emails) when any row comes back. Read-only.
--
-- compute_scores runs hourly and scores every day before today, so yesterday should always be in
-- index_daily. A cron job whose latest run failed, or a source with no successful run in 48 hours
-- (EPSS, Radar and HIBP run at most a few times a day), is reported too.
with problems (problem) as (
  select 'Daily index stops at ' || coalesce(max(day)::text, 'nothing')
    || ' (expected ' || (current_date - 1) || ')'
  from public.index_daily
  having coalesce(max(day), date '1900-01-01') < current_date - 1

  union all

  select 'Cron job ' || j.jobname || ' failed on its last run at '
    || to_char(d.start_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC: '
    || left(regexp_replace(coalesce(d.return_message, ''), '\s+', ' ', 'g'), 200)
  from cron.job j
  join lateral (
    select r.status, r.start_time, r.return_message
    from cron.job_run_details r
    where r.jobid = j.jobid and r.status in ('succeeded', 'failed')
    order by r.start_time desc
    limit 1
  ) d on true
  where j.active and d.status = 'failed'

  union all

  select 'No successful ' || source || ' run since '
    || coalesce(to_char(max(started_at) filter (where status = 'ok') at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC', 'at least 90 days')
  from public.source_runs
  group by source
  having coalesce(max(started_at) filter (where status = 'ok'), '-infinity') < now() - interval '48 hours'
)
select problem from problems;
