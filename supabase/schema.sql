create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_state'
      and policyname = 'Allow all access to app_state'
  ) then
    create policy "Allow all access to app_state"
      on public.app_state
      for all
      using (true)
      with check (true);
  end if;
end $$;