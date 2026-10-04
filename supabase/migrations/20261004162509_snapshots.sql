-- Rendered snapshots, the same JSON the app reads from Storage. The newest row backs get_snapshot(),
-- the app's fallback when the Storage file can't be fetched. Rows older than 30 days are pruned.
create table public.snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  schema_version integer not null,
  body jsonb not null
);

create index snapshots_created_at_idx on public.snapshots (created_at desc);

alter table public.snapshots enable row level security;

grant select, insert, update, delete on public.snapshots to service_role;

-- The only thing the app's publishable key can reach. Returns null until the first snapshot is
-- rendered. Also called nightly as a keep-alive, so the free project doesn't pause.
create function public.get_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select body from public.snapshots order by created_at desc limit 1;
$$;

grant execute on function public.get_snapshot() to anon, authenticated, service_role;
