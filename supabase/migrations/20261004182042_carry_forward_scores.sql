-- Sources update on different days: Radar only stores complete days, so today has no DDoS or
-- phishing score until tomorrow. Rather than letting the index's make-up change day to day, each
-- sub-index contributes its latest score from the last 2 days. Older than that, it's stale and
-- left out (its weight is spread over the others).
create function public.compute_index(p_from date)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.index_daily (day, value, vectors)
  select d.day, round(sum(l.score * v.weight) / sum(v.weight), 1), jsonb_object_agg(v.id, l.score)
  from (select distinct day from public.scores_daily where day >= p_from) d
  cross join public.vectors v
  join lateral (
    select s.score
    from public.scores_daily s
    where s.vector = v.id and s.day <= d.day and s.day >= d.day - 2
    order by s.day desc
    limit 1
  ) l on true
  group by d.day
  on conflict (day) do update set value = excluded.value, vectors = excluded.vectors;
$$;

-- Unchanged apart from handing the index to compute_index().
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

  perform public.compute_index(v_from);
end;
$$;

