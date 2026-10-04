-- Band calibration (step 5 of docs/backend-plan.md). With two years of history, plain percentiles put
-- each sub-index in Severe on 7–35% of days. Now every score is ranked against its own previous two
-- years and placed on the scale so the bands match the design's intent: Low the quietest 3% of
-- days, Guarded the next 21%, Elevated 50%, High 21% and Severe the busiest 5%. The index gets the
-- same treatment. Only complete UTC days are scored, because a day still in progress always looks
-- quiet; the app shows the latest complete day.
--
-- compute_scores() is split into refresh_signals(), compute_vector_scores() and compute_index().

alter table public.scores_daily add column raw numeric(5, 1);
alter table public.index_daily add column raw numeric(5, 1);
comment on column public.scores_daily.raw is 'Mean of the signals'' percentiles, before calibration';
comment on column public.index_daily.raw is 'Weighted mean of the sub-index scores, before calibration';

-- Today's scores and index (a partial day) go; they're recomputed once the day is complete.
delete from public.scores_daily where day >= current_date;
delete from public.index_daily where day >= current_date;

-- Percentile (0–100) to score: piecewise linear through the band edges.
create function public.band_scale(p numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(case
    when p < 3 then p / 3 * 25
    when p < 24 then 25 + (p - 3) / 21 * 25
    when p < 74 then 50 + (p - 24) / 50 * 20
    when p < 95 then 70 + (p - 74) / 21 * 15
    else 85 + least(p - 95, 5) / 5 * 15
  end, 1);
$$;

-- Midrank percentile of a value among earlier values (ties count half).
create function public.midrank(v numeric, earlier numeric[])
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 100.0 * (count(*) filter (where e < v) + 0.5 * count(*) filter (where e = v)) / count(*)
  from unnest(earlier) e;
$$;

-- Turns raw sources into one daily value per signal. Days with no activity are 0 where the source
-- covers them; Radar days are only stored once complete.
create function public.refresh_signals()
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
  select 'radar_' || metric, day, value
  from public.radar_daily
  on conflict (signal, day) do update set value = excluded.value;
end;
$$;

-- Each signal's 7-day total is ranked against its own previous two years (at least 28 days of
-- history). A sub-index's raw value is the mean of its signals' ranks; its score is that raw value
-- ranked against the sub-index's own previous two years (at least 90 days) and calibrated.
create function public.compute_vector_scores(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    where t.day >= p_from and t.day < current_date
    group by t.signal, t.vector, t.day, t.total
    having count(*) >= 28
  )
  insert into public.scores_daily (vector, day, raw, score, components)
  select vector, day, round(avg(pct), 1), round(avg(pct), 1),
    jsonb_object_agg(signal, jsonb_build_object('percentile', round(pct, 1), 'total7d', total, 'history', history))
  from ranked
  group by vector, day
  on conflict (vector, day) do update set raw = excluded.raw, components = excluded.components;

  -- Ranks use raw values, which are already final, so the order rows are updated in doesn't matter.
  update public.scores_daily s
  set score = public.band_scale(coalesce(
    (select public.midrank(s.raw, array_agg(p.raw))
     from public.scores_daily p
     where p.vector = s.vector and p.day >= s.day - 730 and p.day < s.day
     having count(*) >= 90),
    s.raw
  ))
  where s.day >= p_from;
end;
$$;

-- The index's raw value is the weighted mean of each sub-index's latest score from the last 2 days
-- (older than that it's stale and left out). Its value is that raw value ranked against the
-- index's own previous two years and calibrated the same way.
create or replace function public.compute_index(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.index_daily (day, raw, value, vectors)
  select d.day, round(sum(l.score * v.weight) / sum(v.weight), 1), 0, jsonb_object_agg(v.id, l.score)
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
  on conflict (day) do update set raw = excluded.raw, vectors = excluded.vectors;

  update public.index_daily i
  set value = public.band_scale(coalesce(
    (select public.midrank(i.raw, array_agg(p.raw))
     from public.index_daily p
     where p.day >= i.day - 730 and p.day < i.day
     having count(*) >= 90),
    i.raw
  ))
  where i.day >= p_from;
end;
$$;

-- With no argument, redoes the last two complete days, or everything if the index is empty. Run
-- with an early date after a backfill or a method change.
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
begin
  perform public.refresh_signals();
  perform public.compute_vector_scores(v_from);
  perform public.compute_index(v_from);
end;
$$;
