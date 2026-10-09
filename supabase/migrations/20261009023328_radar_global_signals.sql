-- ingest-radar also stores layer 3 volume per region in radar_daily (l3_<region>, read by
-- refresh_area_signals). refresh_signals copied every Radar metric into signals_daily, so those
-- rows broke the signals foreign key and compute_scores failed every hour from 2026-10-05.
-- Only metrics that are global signals are copied now; the rest is unchanged.

-- Turns raw sources into one daily value per signal. Days with no activity are 0 where the source
-- covers them; Radar days are only stored once complete.
create or replace function public.refresh_signals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
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
  select 'radar_' || r.metric, r.day, r.value
  from public.radar_daily r
  join public.signals s on s.id = 'radar_' || r.metric
  on conflict (signal, day) do update set value = excluded.value;
end;
$$;
