-- Events (step 7 of docs/backend-plan.md): rules that turn source data into feed items. The rows
-- hold facts only; render-snapshot words them (Technical and Plain) and builds detail pages.
--
--   kev           each CVE added to CISA KEV (exploit, or ransomware if KEV marks ransomware use)
--   ransom_surge  a ransomware group posts 10 or more victims in a UTC day (about 170 a year)
--   package_wave  a day with at least 200 new malicious packages and at least 5x the median of the
--                 previous 28 days (about 18 a year)
--   breach        each breach added to HIBP (spam lists, fabricated, retired, malware and
--                 stealer-log entries excluded, as in the signal)
--   ddos_spike    Radar layer 7 DDoS volume at least 1.2x the median of the previous 28 days (the
--                 busiest 5% of days, about 15 a year)

-- When this project first saw each KEV entry, so a new entry's event has a real time. Entries
-- loaded before this column existed are given midday on the day CISA added them.
alter table public.kev_entries add column first_seen_at timestamptz not null default now();
update public.kev_entries set first_seen_at = date_added + time '12:00' where date_added < current_date;

create table public.events (
  id text primary key,
  kind text not null check (kind in ('kev', 'ransom_surge', 'package_wave', 'breach', 'ddos_spike')),
  -- EventType in src/data/types.ts.
  type text not null check (type in ('ransomware', 'exploit', 'ddos', 'phishing', 'supply', 'breach')),
  vector text not null references public.vectors (id),
  -- When it happened or, for a day-level rule, when it was first detected (end of day for history).
  at timestamptz not null,
  -- For picking the largest event of a kind: EPSS, posts, packages, ln(accounts) or ratio.
  magnitude numeric not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index events_at_idx on public.events (at);

alter table public.events enable row level security;
grant select on public.events to service_role;

-- Day-level events get the end of their day, or now if that's still to come.
create function public.day_event_at(p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(now(), p_day + time '23:59');
$$;

create function public.generate_events(p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.events (id, kind, type, vector, at, magnitude, data)
  select 'kev-' || k.cve_id, 'kev',
    case when k.ransomware_use then 'ransomware' else 'exploit' end,
    case when k.ransomware_use then 'ransomware' else 'exploitation' end,
    least(greatest(k.first_seen_at, k.date_added::timestamptz), k.date_added + time '23:59'),
    1 + coalesce(e.epss, 0),
    jsonb_build_object(
      'cve', k.cve_id, 'vendor', k.vendor_project, 'product', k.product, 'name', k.vulnerability_name,
      'description', k.short_description, 'action', k.required_action, 'due', k.due_date,
      'ransomware', k.ransomware_use, 'cwes', k.cwes, 'epss', e.epss, 'epss_percentile', e.percentile,
      'added', k.date_added
    )
  from public.kev_entries k
  left join public.epss_tracked e on e.cve_id = k.cve_id
  where k.date_added >= p_from
  on conflict (id) do update set type = excluded.type, vector = excluded.vector, magnitude = excluded.magnitude,
    data = excluded.data, updated_at = now();

  -- Day-level rules keep the time an event was first detected; counts can be revised (late, edited
  -- or removed posts, late packages, rescaled Radar), so events that no longer qualify are removed.
  insert into public.events (id, kind, type, vector, at, magnitude, data)
  select 'ransom-' || r.group_name || '-' || r.day, 'ransom_surge', 'ransomware', 'ransomware',
    public.day_event_at(r.day), r.posts,
    jsonb_build_object('group', r.group_name, 'posts', r.posts, 'day', r.day)
  from public.ransom_counts_daily r
  where r.day >= p_from and r.posts >= 10
  on conflict (id) do update set magnitude = excluded.magnitude, data = excluded.data, updated_at = now();
  delete from public.events v where v.kind = 'ransom_surge' and v.at >= p_from and not exists (
    select 1 from public.ransom_counts_daily r
    where 'ransom-' || r.group_name || '-' || r.day = v.id and r.posts >= 10
  );

  insert into public.events (id, kind, type, vector, at, magnitude, data)
  select 'packages-' || s.day, 'package_wave', 'supply', 'supply', public.day_event_at(s.day), s.value,
    jsonb_build_object(
      'packages', s.value, 'day', s.day, 'normal', m.median,
      'ecosystems', (select jsonb_object_agg(ecosystem, n) from (
        select ecosystem, count(*) n from public.malicious_packages
        where published = s.day and not withdrawn group by ecosystem
      ) e)
    )
  from public.signals_daily s
  cross join lateral (
    select (percentile_cont(0.5) within group (order by p.value))::numeric as median
    from public.signals_daily p
    where p.signal = 'osv_malicious' and p.day between s.day - 28 and s.day - 1
  ) m
  where s.signal = 'osv_malicious' and s.day >= p_from and s.value >= 200 and s.value >= 5 * m.median
  on conflict (id) do update set magnitude = excluded.magnitude, data = excluded.data, updated_at = now();
  delete from public.events v where v.kind = 'package_wave' and v.at >= p_from and v.updated_at < now();

  insert into public.events (id, kind, type, vector, at, magnitude, data)
  select 'hibp-' || b.name, 'breach', 'breach', 'insider', b.added_at, ln(1 + b.pwn_count),
    jsonb_build_object(
      'name', b.name, 'title', b.title, 'domain', b.domain, 'accounts', b.pwn_count,
      'data_classes', b.data_classes, 'breach_date', b.breach_date, 'added', b.added_at,
      'verified', b.is_verified, 'sensitive', b.is_sensitive
    )
  from public.hibp_breaches b
  where b.added_at >= p_from
    and not (b.is_spam_list or b.is_fabricated or b.is_retired or b.is_malware or b.is_stealer_log)
  on conflict (id) do update set magnitude = excluded.magnitude, data = excluded.data, updated_at = now();
  -- A breach HIBP later flags (or removes) stops being an event.
  delete from public.events v where v.kind = 'breach' and v.at >= p_from and not exists (
    select 1 from public.hibp_breaches b
    where 'hibp-' || b.name = v.id
      and not (b.is_spam_list or b.is_fabricated or b.is_retired or b.is_malware or b.is_stealer_log)
  );

  insert into public.events (id, kind, type, vector, at, magnitude, data)
  select 'ddos-l7-' || r.day, 'ddos_spike', 'ddos', 'ddos', public.day_event_at(r.day), r.value / m.median,
    jsonb_build_object('day', r.day, 'ratio', round(r.value / m.median, 3), 'layer', 7)
  from public.radar_daily r
  cross join lateral (
    select (percentile_cont(0.5) within group (order by p.value))::numeric as median
    from public.radar_daily p
    where p.metric = 'l7' and p.day between r.day - 28 and r.day - 1
    having count(*) >= 21
  ) m
  where r.metric = 'l7' and r.day >= p_from and m.median > 0 and r.value >= 1.2 * m.median
  on conflict (id) do update set magnitude = excluded.magnitude, data = excluded.data, updated_at = now();
  delete from public.events v where v.kind = 'ddos_spike' and v.at >= p_from and v.updated_at < now();
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
  -- Events also cover today, and a few days back for late KEV, HIBP and RansomLook updates.
  perform public.generate_events(least(v_from, current_date - 3));
end;
$$;
