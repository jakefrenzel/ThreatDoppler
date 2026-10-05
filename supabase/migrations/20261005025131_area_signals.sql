-- Sector- and region-specific signals. Until now a sector's score differed from the global one only
-- through its usual attack mix (area_profiles), so sectors moved together. Three signals now let
-- areas diverge for real reasons:
--   ransom_sector  ransomware posts per sector: the day's RansomLook posts times the sector's share
--                  of the posts whose description could be classified over the last 7 days (shares,
--                  not counts, because older posts carry descriptions less often)
--   ddos_sector    Cloudflare Radar's share of layer 7 DDoS requests per industry, mapped to sectors,
--                  times the global layer 7 volume
--   ddos_region    Cloudflare Radar's layer 3 DDoS volume by target location, per region
-- Each is ranked against its own two years like the global signals. For an area, a sub-index with
-- its own score uses the mean of that and the global score; the rest use the global score.

-- Classified ransomware posts per sector per day (counts only; descriptions are never stored).
create table public.ransom_sector_daily (
  day date not null,
  sector text not null,
  posts integer not null check (posts > 0),
  primary key (day, sector)
);

-- Share (percent) of Radar's layer 7 attack requests aimed at each sector's industries.
create table public.radar_sector_daily (
  day date not null,
  sector text not null,
  share numeric not null check (share >= 0),
  primary key (day, sector)
);

create table public.area_signals_daily (
  kind text not null check (kind in ('sector', 'region')),
  area text not null,
  signal text not null check (signal in ('ransom_sector', 'ddos_sector', 'ddos_region')),
  vector text not null references public.vectors (id),
  day date not null,
  value numeric not null,
  primary key (kind, area, signal, day)
);

create table public.area_vector_scores_daily (
  kind text not null,
  area text not null,
  vector text not null references public.vectors (id),
  day date not null,
  raw numeric(5, 1) not null,
  score numeric(5, 1) not null,
  components jsonb not null,
  primary key (kind, area, vector, day)
);

alter table public.ransom_sector_daily enable row level security;
alter table public.radar_sector_daily enable row level security;
alter table public.area_signals_daily enable row level security;
alter table public.area_vector_scores_daily enable row level security;

grant select on public.ransom_sector_daily, public.area_signals_daily, public.area_vector_scores_daily to service_role;
grant select, insert, update on public.radar_sector_daily to service_role;

-- Replaces sector counts from p_from onwards in one transaction (as replace_ransom_counts does).
create function public.replace_ransom_sectors(p_from date, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from public.ransom_sector_daily where day >= p_from;
  insert into public.ransom_sector_daily (day, sector, posts)
  select r.day, r.sector, r.posts
  from jsonb_to_recordset(p_rows) as r (day date, sector text, posts integer)
  where r.day >= p_from and r.posts > 0;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.replace_ransom_sectors(date, jsonb) to service_role;

create function public.refresh_area_signals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ransomware: total posts that day times the sector's share of classified posts over 7 days.
  with sectors as (
    select distinct area as sector from public.area_profiles where kind = 'sector'
  ),
  days as (
    select d::date as day
    from generate_series((select min(day) from public.ransom_sector_daily), current_date, interval '1 day') d
  ),
  counts as (
    select d.day, s.sector, coalesce(r.posts, 0) as n
    from days d
    cross join sectors s
    left join public.ransom_sector_daily r on r.day = d.day and r.sector = s.sector
  ),
  weekly as (
    select day, sector, sum(n) over (partition by sector order by day rows between 6 preceding and current row) as n7
    from counts
  ),
  classified as (
    select day, sum(n7) as c7 from weekly group by day
  ),
  totals as (
    select day, sum(posts) as total from public.ransom_counts_daily group by day
  )
  insert into public.area_signals_daily (kind, area, signal, vector, day, value)
  select 'sector', w.sector, 'ransom_sector', 'ransomware', w.day, round(coalesce(t.total, 0) * w.n7 / c.c7, 3)
  from weekly w
  join classified c on c.day = w.day and c.c7 > 0
  left join totals t on t.day = w.day
  on conflict (kind, area, signal, day) do update set value = excluded.value;

  -- DDoS by sector: the sector's share of layer 7 attack requests times the global volume.
  insert into public.area_signals_daily (kind, area, signal, vector, day, value)
  select 'sector', r.sector, 'ddos_sector', 'ddos', r.day, round(r.share / 100 * l.value, 6)
  from public.radar_sector_daily r
  join public.radar_daily l on l.metric = 'l7' and l.day = r.day
  on conflict (kind, area, signal, day) do update set value = excluded.value;

  -- DDoS by region: layer 3 volume by target location, stored by ingest-radar as l3_<region>.
  insert into public.area_signals_daily (kind, area, signal, vector, day, value)
  select 'region', substr(metric, 4), 'ddos_region', 'ddos', day, value
  from public.radar_daily
  where metric in ('l3_nam', 'l3_europe', 'l3_apac', 'l3_mea', 'l3_latam')
  on conflict (kind, area, signal, day) do update set value = excluded.value;
end;
$$;

-- The same method as compute_vector_scores(), per area: each signal's level (5-day half-life over
-- 35 days) ranked against its own two years, averaged per sub-index, then that raw value ranked
-- against the area's own two years for that sub-index and calibrated.
create function public.compute_area_vector_scores(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with levels as (
    select s.kind, s.area, s.signal, s.vector, s.day,
      round(sum(p.value * power(0.5, (s.day - p.day) / 5.0)), 6) as total
    from public.area_signals_daily s
    join public.area_signals_daily p
      on p.kind = s.kind and p.area = s.area and p.signal = s.signal and p.day > s.day - 35 and p.day <= s.day
    where s.day >= p_from - 730 and s.day < current_date
    group by s.kind, s.area, s.signal, s.vector, s.day
    having count(*) = 35
  ),
  ranked as (
    select t.kind, t.area, t.signal, t.vector, t.day, t.total,
      100.0 * (count(*) filter (where p.total < t.total) + 0.5 * count(*) filter (where p.total = t.total))
        / count(*) as pct,
      count(*) as history
    from levels t
    join levels p
      on p.kind = t.kind and p.area = t.area and p.signal = t.signal and p.day >= t.day - 730 and p.day < t.day
    where t.day >= p_from
    group by t.kind, t.area, t.signal, t.vector, t.day, t.total
    having count(*) >= 28
  )
  insert into public.area_vector_scores_daily (kind, area, vector, day, raw, score, components)
  select kind, area, vector, day, round(avg(pct), 1), round(avg(pct), 1),
    jsonb_object_agg(signal, jsonb_build_object('percentile', round(pct, 1), 'level', total, 'history', history))
  from ranked
  group by kind, area, vector, day
  on conflict (kind, area, vector, day) do update set raw = excluded.raw, components = excluded.components;

  update public.area_vector_scores_daily s
  set score = public.band_scale(coalesce(
    (select public.midrank(s.raw, array_agg(p.raw))
     from public.area_vector_scores_daily p
     where p.kind = s.kind and p.area = s.area and p.vector = s.vector and p.day >= s.day - 730 and p.day < s.day
     having count(*) >= 90),
    s.raw
  ))
  where s.day >= p_from;
end;
$$;

-- As before, plus: a sub-index with its own score for this area (from the last 2 days) uses the
-- mean of that and the global score.
create or replace function public.compute_area_scores(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.area_scores_daily (kind, area, day, raw, score, top_vector)
  select a.kind, a.area, d.day,
    round(sum(e.score * v.weight * a.lift) / sum(v.weight * a.lift), 1),
    0,
    (array_agg(v.id order by e.score * v.weight * a.lift desc))[1]
  from (select distinct day from public.index_daily where day >= p_from) d
  cross join public.area_profiles a
  join public.vectors v on v.id = a.vector
  join lateral (
    select s.score
    from public.scores_daily s
    where s.vector = v.id and s.day <= d.day and s.day >= d.day - 2
    order by s.day desc
    limit 1
  ) l on true
  left join lateral (
    select x.score
    from public.area_vector_scores_daily x
    where x.kind = a.kind and x.area = a.area and x.vector = v.id and x.day <= d.day and x.day >= d.day - 2
    order by x.day desc
    limit 1
  ) own on true
  cross join lateral (select coalesce((l.score + own.score) / 2, l.score) as score) e
  group by a.kind, a.area, d.day
  on conflict (kind, area, day) do update set raw = excluded.raw, top_vector = excluded.top_vector;

  update public.area_scores_daily x
  set score = public.band_scale(coalesce(
    (select public.midrank(x.raw, array_agg(p.raw))
     from public.area_scores_daily p
     where p.kind = x.kind and p.area = x.area and p.day >= x.day - 730 and p.day < x.day
     having count(*) >= 90),
    x.raw
  ))
  where x.day >= p_from;
end;
$$;

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
  perform public.refresh_area_signals();
  perform public.compute_area_vector_scores(v_from);
  perform public.compute_area_scores(v_from);
  -- Events also cover today, and a few days back for late KEV, HIBP and RansomLook updates.
  perform public.generate_events(least(v_from, current_date - 3));
end;
$$;
