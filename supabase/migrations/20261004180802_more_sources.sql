-- Remaining sources (step 4 of docs/backend-plan.md): RansomLook, HIBP, OSV malicious packages and
-- Cloudflare Radar (DDoS, and email threats for phishing), and compute_scores() extended to turn
-- them into signals.

insert into public.signals (id, vector, description) values
  ('ransomlook_posts', 'ransomware', 'Victim posts on ransomware leak sites, from RansomLook'),
  ('kev_ransomware', 'ransomware', 'CVEs added to KEV that are known to be used in ransomware campaigns'),
  ('osv_malicious', 'supply', 'Malicious packages published in OSV (MAL- records), all ecosystems'),
  ('hibp_breaches', 'insider', 'Breaches added to HIBP, each weighted by ln(1 + accounts affected)'),
  ('radar_l3', 'ddos', 'Cloudflare Radar layer 3/4 DDoS attack volume (rescaled, see radar_daily)'),
  ('radar_l7', 'ddos', 'Cloudflare Radar layer 7 DDoS attack volume (rescaled, see radar_daily)'),
  ('radar_email_malicious', 'phishing', 'Share of all email that Cloudflare Radar flags as malicious, in percent'),
  ('radar_email_credential', 'phishing', 'Share of all email that is malicious and harvests credentials, in percent');

-- Posts per ransomware group per day (UTC). Counts only: victim names are never stored.
create table public.ransom_counts_daily (
  day date not null,
  group_name text not null,
  posts integer not null check (posts > 0),
  primary key (day, group_name)
);

-- The HIBP breach list (about 1,000 rows), replaced on every run. added_at is when HIBP added the
-- breach, which is what the signal counts; breach_date is only a guide.
create table public.hibp_breaches (
  name text primary key,
  title text not null,
  domain text,
  breach_date date,
  added_at timestamptz not null,
  modified_at timestamptz,
  pwn_count bigint not null,
  data_classes text[] not null default '{}',
  description text,
  is_verified boolean not null,
  is_fabricated boolean not null,
  is_sensitive boolean not null,
  is_retired boolean not null,
  is_spam_list boolean not null,
  is_malware boolean not null,
  is_stealer_log boolean not null,
  updated_at timestamptz not null default now()
);

create index hibp_breaches_added_at_idx on public.hibp_breaches (added_at);

-- MAL- records published in the last 30 days. Older days are kept only as signal values.
create table public.malicious_packages (
  id text primary key,
  ecosystem text not null,
  published date not null,
  withdrawn boolean not null default false,
  fetched_at timestamptz not null default now()
);

create index malicious_packages_published_idx on public.malicious_packages (published);

-- How far ingest-osv has read each ecosystem's modified_id.csv (newest first), and its ETag.
create table public.osv_cursors (
  ecosystem text primary key,
  read_to timestamptz not null,
  etag text
);

-- Radar only publishes normalised series. Each fetch is rescaled to match the days already stored,
-- so this table is one consistent series per metric. Kept indefinitely (two rows a day).
create table public.radar_daily (
  metric text not null,
  day date not null,
  value numeric not null,
  primary key (metric, day)
);

alter table public.ransom_counts_daily enable row level security;
alter table public.hibp_breaches enable row level security;
alter table public.malicious_packages enable row level security;
alter table public.osv_cursors enable row level security;
alter table public.radar_daily enable row level security;

grant select on public.ransom_counts_daily to service_role;
grant select, insert, update, delete on public.hibp_breaches to service_role;
grant select, insert, update on public.malicious_packages to service_role;
grant select, insert, update on public.osv_cursors to service_role;
grant select, insert, update on public.radar_daily to service_role;

-- Replaces every count from p_from onwards in one transaction, so late, edited and removed posts
-- are reflected and readers never see a half-written window.
create function public.replace_ransom_counts(p_from date, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from public.ransom_counts_daily where day >= p_from;
  insert into public.ransom_counts_daily (day, group_name, posts)
  select r.day, r.group_name, r.posts
  from jsonb_to_recordset(p_rows) as r (day date, group_name text, posts integer)
  where r.day >= p_from and r.posts > 0;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.replace_ransom_counts(date, jsonb) to service_role;

-- Same method as before (see the exploitation migration); only the signal refresh grows.
create or replace function public.compute_scores(p_from date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date := coalesce(
    p_from,
    (select max(day) - 1 from public.index_daily),
    date '2021-01-01'
  );
  -- OSV counts keep growing for about a week after a day ends (late imports), so recent days are
  -- recounted. Older days keep the value they had when their raw rows were pruned.
  v_osv_from date := greatest(current_date - 14, (select min(published) from public.malicious_packages));
begin
  -- KEV additions per day, all of them and those used in ransomware, including days with none.
  insert into public.signals_daily (signal, day, value)
  select s.signal, d::date, count(k.cve_id)
  from generate_series(
    (select min(date_added) from public.kev_entries),
    current_date,
    interval '1 day'
  ) d
  cross join (values ('kev_additions', false), ('kev_ransomware', true)) as s (signal, ransomware_only)
  left join public.kev_entries k on k.date_added = d::date and (k.ransomware_use or not s.ransomware_only)
  group by s.signal, d
  on conflict (signal, day) do update set value = excluded.value;

  insert into public.signals_daily (signal, day, value)
  select 'ransomlook_posts', d::date, coalesce(sum(r.posts), 0)
  from generate_series(
    (select min(day) from public.ransom_counts_daily),
    current_date,
    interval '1 day'
  ) d
  left join public.ransom_counts_daily r on r.day = d::date
  group by d
  on conflict (signal, day) do update set value = excluded.value;

  -- Spam lists, fabricated, retired, malware and stealer-log entries aren't breaches of a service.
  insert into public.signals_daily (signal, day, value)
  select 'hibp_breaches', d::date, coalesce(round(sum(ln(1 + b.pwn_count))::numeric, 3), 0)
  from generate_series(date '2021-01-01', current_date, interval '1 day') d
  left join public.hibp_breaches b
    on (b.added_at at time zone 'UTC')::date = d::date
    and not (b.is_spam_list or b.is_fabricated or b.is_retired or b.is_malware or b.is_stealer_log)
  group by d
  on conflict (signal, day) do update set value = excluded.value;

  if v_osv_from is not null then
    insert into public.signals_daily (signal, day, value)
    select 'osv_malicious', d::date, count(m.id)
    from generate_series(v_osv_from, current_date, interval '1 day') d
    left join public.malicious_packages m on m.published = d::date and not m.withdrawn
    group by d
    on conflict (signal, day) do update set value = excluded.value;
  end if;
  delete from public.malicious_packages where published < current_date - 30;

  -- Radar days are only stored once complete, so a missing day is missing data, not zero.
  insert into public.signals_daily (signal, day, value)
  select 'radar_' || metric, day, value
  from public.radar_daily
  on conflict (signal, day) do update set value = excluded.value;

  with sums as (
    select s.signal, g.vector, s.day,
      sum(s.value) over w as total,
      count(*) over w as days
    from public.signals_daily s
    join public.signals g on g.id = s.signal
    window w as (partition by s.signal order by s.day range between interval '6 days' preceding and current row)
  ),
  weekly as (
    select signal, vector, day, total from sums where days = 7
  ),
  ranked as (
    select t.signal, t.vector, t.day, t.total,
      100.0 * (count(*) filter (where p.total < t.total) + 0.5 * count(*) filter (where p.total = t.total))
        / count(*) as pct,
      count(*) as history
    from weekly t
    join weekly p on p.signal = t.signal and p.day >= t.day - 730 and p.day < t.day
    where t.day >= v_from
    group by t.signal, t.vector, t.day, t.total
    having count(*) >= 28
  )
  insert into public.scores_daily (vector, day, score, components)
  select vector, day, round(avg(pct), 1),
    jsonb_object_agg(signal, jsonb_build_object('percentile', round(pct, 1), 'total7d', total, 'history', history))
  from ranked
  group by vector, day
  on conflict (vector, day) do update set score = excluded.score, components = excluded.components;

  insert into public.index_daily (day, value, vectors)
  select s.day, round(sum(s.score * v.weight) / sum(v.weight), 1), jsonb_object_agg(s.vector, s.score)
  from public.scores_daily s
  join public.vectors v on v.id = s.vector
  where s.day >= v_from
  group by s.day
  on conflict (day) do update set value = excluded.value, vectors = excluded.vectors;
end;
$$;

-- Schedules. Sources that change slowly run less often.
select cron.schedule('ingest-ransomlook', '12 * * * *', $$select public.invoke_function('ingest-ransomlook')$$);
select cron.schedule('ingest-osv', '27 * * * *', $$select public.invoke_function('ingest-osv')$$);
select cron.schedule('ingest-hibp', '37 */6 * * *', $$select public.invoke_function('ingest-hibp')$$);
select cron.schedule('ingest-radar', '50 1 * * *', $$select public.invoke_function('ingest-radar')$$);
