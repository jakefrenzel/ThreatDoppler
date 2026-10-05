-- Push alerts (milestone 2, docs/push-plan.md): devices, what each rule last fired, and deliveries.
-- There are no accounts: a device is its Expo push token. The app can only reach the three RPCs at
-- the end (register, unregister, read its own deliveries); everything else is for server jobs.

create table public.devices (
  id bigint generated always as identity primary key,
  token text not null unique check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$'),
  platform text not null check (platform in ('ios', 'android')),
  time_zone text not null,
  wording text not null check (wording in ('plain', 'standard', 'technical')),
  -- {"enabled": true, "start": "22:00", "end": "06:30"}, in the device's time zone.
  quiet_hours jsonb not null,
  -- The app's alert rules (AlertRule in src/state/store.ts), as last synced. Only enabled rules with
  -- the push channel are acted on.
  rules jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Set when Expo reports the token is no longer registered; cleared if the app registers again.
  disabled_at timestamptz,
  disabled_reason text
);

-- What each rule last fired on, so a threshold fires when it's crossed rather than every hour.
create table public.alert_state (
  device_id bigint not null references public.devices (id) on delete cascade,
  rule_id text not null,
  -- e.g. the day a threshold was crossed, or the time of the last exploited flaw seen.
  last_key text not null,
  last_fired_at timestamptz not null default now(),
  primary key (device_id, rule_id)
);

create table public.deliveries (
  id bigint generated always as identity primary key,
  device_id bigint not null references public.devices (id) on delete cascade,
  rule_id text,
  kind text not null check (kind in ('alert', 'morning', 'held', 'bundle', 'test')),
  title text not null,
  body text not null,
  -- Where a tap should go in the app, e.g. {"path": "/threat/kev-CVE-2026-1"}.
  data jsonb not null default '{}',
  -- Severe crossings skip quiet hours.
  urgent boolean not null default false,
  created_at timestamptz not null default now(),
  -- held: waiting for quiet hours to end. queued: ready to send. sent: Expo accepted it (ticket).
  -- delivered / failed: from the receipt.
  status text not null default 'queued' check (status in ('held', 'queued', 'sent', 'delivered', 'failed')),
  sent_at timestamptz,
  ticket_id text,
  error text
);

create index deliveries_device_created_idx on public.deliveries (device_id, created_at desc);
create index deliveries_status_idx on public.deliveries (status) where status in ('held', 'queued', 'sent');

alter table public.devices enable row level security;
alter table public.alert_state enable row level security;
alter table public.deliveries enable row level security;

grant select, insert, update, delete on public.devices, public.alert_state, public.deliveries to service_role;

-- Checks the app's rules and keeps only the fields the server uses. Raises on anything unexpected,
-- so a bad or hostile payload is rejected rather than stored.
create function public.clean_rules(p_rules jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rule jsonb;
  v_out jsonb := '[]';
  v_targets jsonb;
  v_kind text;
  v_condition text;
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 50 or octet_length(p_rules::text) > 20000 then
    raise exception 'rules must be an array of at most 50 rules';
  end if;
  for v_rule in select * from jsonb_array_elements(p_rules) loop
    v_kind := v_rule->>'kind';
    v_condition := v_rule->>'condition';
    if coalesce(length(v_rule->>'id'), 0) not between 1 and 64
      or v_kind not in ('index', 'sector', 'region', 'vector', 'vuln', 'digest')
      or v_condition not in ('above', 'jump', 'band', 'daily', 'weekly')
      or jsonb_typeof(v_rule->'value') <> 'number'
      or (v_rule->>'value')::numeric not between 0 and 100
      or jsonb_typeof(v_rule->'enabled') <> 'boolean'
      or jsonb_typeof(v_rule->'channels') <> 'array'
      or jsonb_typeof(v_rule->'targets') <> 'array'
      or jsonb_array_length(v_rule->'targets') > 20 then
      raise exception 'invalid rule %', left(v_rule::text, 200);
    end if;
    -- Targets must be known ids for the rule's kind.
    v_targets := v_rule->'targets';
    if exists (
      select 1 from jsonb_array_elements_text(v_targets) t
      where not case v_kind
        when 'sector' then exists (select 1 from public.area_profiles a where a.kind = 'sector' and a.area = t)
        when 'region' then exists (select 1 from public.area_profiles a where a.kind = 'region' and a.area = t)
        when 'vector' then exists (select 1 from public.vectors v where v.id = t)
        else true
      end
    ) then
      raise exception 'unknown target in rule %', v_rule->>'id';
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_rule->>'id',
      'kind', v_kind,
      'condition', v_condition,
      'targets', v_targets,
      'value', (v_rule->>'value')::numeric,
      'enabled', (v_rule->>'enabled')::boolean,
      'push', v_rule->'channels' ? 'push'
    ));
  end loop;
  return v_out;
end;
$$;

create function public.register_device(
  p_token text,
  p_platform text,
  p_time_zone text,
  p_wording text,
  p_quiet_hours jsonb,
  p_rules jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'unknown time zone';
  end if;
  if jsonb_typeof(p_quiet_hours->'enabled') <> 'boolean'
    or coalesce(p_quiet_hours->>'start', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
    or coalesce(p_quiet_hours->>'end', '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception 'invalid quiet hours';
  end if;
  insert into public.devices (token, platform, time_zone, wording, quiet_hours, rules)
  values (
    p_token, p_platform, p_time_zone, p_wording,
    jsonb_build_object('enabled', (p_quiet_hours->>'enabled')::boolean, 'start', p_quiet_hours->>'start', 'end', p_quiet_hours->>'end'),
    public.clean_rules(p_rules)
  )
  on conflict (token) do update set
    platform = excluded.platform,
    time_zone = excluded.time_zone,
    wording = excluded.wording,
    quiet_hours = excluded.quiet_hours,
    rules = excluded.rules,
    updated_at = now(),
    last_seen_at = now(),
    disabled_at = null,
    disabled_reason = null;
end;
$$;

create function public.unregister_device(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.devices where token = p_token;
$$;

-- This device's last 20 deliveries from the past week, newest first, for "Recent deliveries".
create function public.get_deliveries(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'at', coalesce(d.sent_at, d.created_at),
      'kind', d.kind,
      'title', d.title,
      'body', d.body,
      'status', d.status
    ) as x
    from public.deliveries d
    join public.devices v on v.id = d.device_id
    where v.token = p_token and d.created_at > now() - interval '7 days'
    order by d.created_at desc
    limit 20
  ) s;
$$;

grant execute on function public.register_device(text, text, text, text, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.unregister_device(text) to anon, authenticated, service_role;
grant execute on function public.get_deliveries(text) to anon, authenticated, service_role;

-- Housekeeping: deliveries matter for a month; devices not seen in 90 days are gone.
select cron.schedule(
  'prune-push',
  '55 3 * * *',
  $$
    delete from public.deliveries where created_at < now() - interval '30 days';
    delete from public.devices where last_seen_at < now() - interval '90 days';
  $$
);
