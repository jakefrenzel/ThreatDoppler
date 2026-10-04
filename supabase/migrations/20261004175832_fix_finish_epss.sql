-- Supabase's safeupdate extension rejects DELETE without a WHERE clause on API connections, and
-- that includes functions called through the API. Replace the table with truncate instead.
create or replace function public.finish_epss(p_score_date date, p_model_version text, p_scored integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  prev public.epss_daily;
  v_crossings integer;
begin
  if exists (select 1 from public.epss_daily where score_date = p_score_date) then
    truncate public.epss_staging;
    return false;
  end if;

  select * into prev from public.epss_daily
  where score_date < p_score_date
  order by score_date desc
  limit 1;

  -- A CVE missing from epss_tracked was at or below 0.1 yesterday, so it counts as crossing.
  if prev.score_date = p_score_date - 1 and prev.model_version = p_model_version then
    select count(*) into v_crossings
    from public.epss_staging s
    left join public.epss_tracked t on t.cve_id = s.cve_id
    where s.epss > 0.5 and (t.epss is null or t.epss <= 0.5);
  end if;

  insert into public.epss_daily (score_date, model_version, scored, tracked, above_05, crossings)
  select p_score_date, p_model_version, p_scored, count(*), count(*) filter (where epss > 0.5), v_crossings
  from public.epss_staging;

  truncate public.epss_tracked;
  insert into public.epss_tracked (cve_id, epss, percentile, score_date)
  select distinct on (cve_id) cve_id, epss, percentile, p_score_date
  from public.epss_staging;
  truncate public.epss_staging;

  if v_crossings is not null then
    insert into public.signals_daily (signal, day, value)
    values ('epss_crossings', p_score_date, v_crossings)
    on conflict (signal, day) do update set value = excluded.value;
  end if;

  return true;
end;
$$;
