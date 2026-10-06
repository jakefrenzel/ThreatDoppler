-- Tags feed events with the sectors they hit (eventSectors in supabase/functions/_shared/events.ts):
-- a ransomware surge carries the sectors of that gang's posts that day, and a DDoS spike Radar's
-- share of that day's layer 7 attacks per sector. Counts only; descriptions are never stored.

create table public.ransom_group_sector_daily (
  day date not null,
  group_name text not null,
  sector text not null,
  posts integer not null check (posts > 0),
  primary key (day, group_name, sector)
);

alter table public.ransom_group_sector_daily enable row level security;
grant select on public.ransom_group_sector_daily to service_role;

-- Replaces per-group sector counts from p_from onwards (as replace_ransom_sectors does).
create function public.replace_ransom_group_sectors(p_from date, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from public.ransom_group_sector_daily where day >= p_from;
  insert into public.ransom_group_sector_daily (day, group_name, sector, posts)
  select r.day, r.group_name, r.sector, r.posts
  from jsonb_to_recordset(p_rows) as r (day date, group_name text, sector text, posts integer)
  where r.day >= p_from and r.posts > 0;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.replace_ransom_group_sectors(date, jsonb) to service_role;

create or replace function public.generate_events(p_from date)
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
    jsonb_build_object('group', r.group_name, 'posts', r.posts, 'day', r.day,
      'sectors', coalesce((select jsonb_object_agg(g.sector, g.posts) from public.ransom_group_sector_daily g
        where g.day = r.day and g.group_name = r.group_name), '{}'))
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
    jsonb_build_object('day', r.day, 'ratio', round(r.value / m.median, 3), 'layer', 7,
      'sectors', coalesce((select jsonb_object_agg(s.sector, s.share) from public.radar_sector_daily s
        where s.day = r.day), '{}'))
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
