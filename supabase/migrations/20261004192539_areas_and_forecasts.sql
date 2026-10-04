-- Sectors, regions and forecasts (step 6 of docs/backend-plan.md).
--
-- Sector and region scores are modelled: the six global sub-index scores, weighted by each area's
-- usual mix of attack types from VCDB (area_profiles, loaded by scripts/vcdb). An area's raw value
-- is that weighted mean; it's ranked against the area's own previous two years and calibrated like
-- the index, so the bands mean the same everywhere.

create table public.area_profiles (
  kind text not null check (kind in ('sector', 'region')),
  area text not null,
  vector text not null references public.vectors (id),
  -- How much more (above 1) or less often this attack type shows up in the area's incidents than
  -- in all incidents, shrunk towards 1 for small samples and clipped to 0.5–2.
  lift numeric not null check (lift > 0),
  incidents integer not null,
  area_incidents integer not null,
  updated_at timestamptz not null default now(),
  primary key (kind, area, vector)
);

create table public.area_scores_daily (
  kind text not null check (kind in ('sector', 'region')),
  area text not null,
  day date not null,
  raw numeric(5, 1) not null,
  score numeric(5, 1) not null,
  top_vector text not null references public.vectors (id),
  primary key (kind, area, day)
);

-- One row per forecast made: the series (index or a sub-index), the last complete day it was made
-- from, and each of the next 7 days. Kept so the app's error figure is measured, not claimed.
create table public.forecasts (
  series text not null,
  made_from date not null,
  horizon integer not null check (horizon between 1 and 7),
  target_day date not null,
  point numeric(5, 1) not null,
  lo numeric(5, 1) not null,
  hi numeric(5, 1) not null,
  created_at timestamptz not null default now(),
  primary key (series, made_from, horizon)
);

create index forecasts_target_day_idx on public.forecasts (target_day);

alter table public.area_profiles enable row level security;
alter table public.area_scores_daily enable row level security;
alter table public.forecasts enable row level security;

grant select on public.area_profiles, public.area_scores_daily to service_role;
grant select, insert on public.forecasts to service_role;

create function public.compute_area_scores(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Each sub-index's latest score from the last 2 days, as in compute_index().
  insert into public.area_scores_daily (kind, area, day, raw, score, top_vector)
  select a.kind, a.area, d.day,
    round(sum(l.score * v.weight * a.lift) / sum(v.weight * a.lift), 1),
    0,
    (array_agg(v.id order by l.score * v.weight * a.lift desc))[1]
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
  perform public.compute_area_scores(v_from);
end;
$$;
