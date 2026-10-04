-- Smoother signals (step 5). A plain 7-day total counts a busy day in full for a week and then
-- drops it at once, so one spike made scores fall off a cliff a week later (e.g. 715 malicious
-- packages on 2026-09-22). Each signal's level is now an exponentially weighted total: a day's
-- weight halves every 5 days, so spikes fade out over a few weeks. Tested against the last year: the
-- average daily move of a signal's rank fell from 5.2 to 4.6 points, and the 95th percentile from 24
-- to 14. (A 3-day half-life was jumpier than the 7-day total; 7 days reacted too slowly.)

-- Each signal's recent level is ranked against its own previous two years (at least 28 days of
-- history). A sub-index's raw value is the mean of its signals' ranks; its score is that raw value
-- ranked against the sub-index's own previous two years (at least 90 days) and calibrated.
create or replace function public.compute_vector_scores(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A signal's level is a weighted total of its last 35 days, each day counting half as much
  -- as one 5 days newer. Only days with all 35 days present are ranked.
  with levels as (
    select s.signal, g.vector, s.day,
      round(sum(p.value * power(0.5, (s.day - p.day) / 5.0)), 3) as total
    from public.signals_daily s
    join public.signals g on g.id = s.signal
    join public.signals_daily p on p.signal = s.signal and p.day > s.day - 35 and p.day <= s.day
    where s.day >= p_from - 730 and s.day < current_date
    group by s.signal, g.vector, s.day
    having count(*) = 35
  ),
  ranked as (
    select t.signal, t.vector, t.day, t.total,
      100.0 * (count(*) filter (where p.total < t.total) + 0.5 * count(*) filter (where p.total = t.total))
        / count(*) as pct,
      count(*) as history
    from levels t
    join levels p on p.signal = t.signal and p.day >= t.day - 730 and p.day < t.day
    where t.day >= p_from and t.day < current_date
    group by t.signal, t.vector, t.day, t.total
    having count(*) >= 28
  )
  insert into public.scores_daily (vector, day, raw, score, components)
  select vector, day, round(avg(pct), 1), round(avg(pct), 1),
    jsonb_object_agg(signal, jsonb_build_object('percentile', round(pct, 1), 'level', total, 'history', history))
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


-- A full compute now takes several seconds, close to the API's 8 s statement timeout, so it runs
-- as its own cron job (no timeout) a few minutes before render-snapshot, which only reads.
select cron.schedule('compute-scores', '15 * * * *', $$select public.compute_scores()$$);
