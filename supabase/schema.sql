create extension if not exists pgcrypto;

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  body text not null,
  folder text not null default '未分類',
  tags text[] not null default '{}',
  ai_targets text[] not null default '{汎用}',
  is_favorite boolean not null default false,
  variables jsonb not null default '[]'::jsonb,
  use_count integer not null default 0,
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_user_updated_idx
  on public.prompts(user_id, updated_at desc);

create index if not exists prompts_user_active_updated_idx
  on public.prompts(user_id, updated_at desc)
  where deleted_at is null;

alter table public.prompts enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.prompts to authenticated;

drop policy if exists "Users can read own prompts" on public.prompts;
create policy "Users can read own prompts"
  on public.prompts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own prompts" on public.prompts;
create policy "Users can insert own prompts"
  on public.prompts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own prompts" on public.prompts;
create policy "Users can update own prompts"
  on public.prompts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own prompts" on public.prompts;
create policy "Users can delete own prompts"
  on public.prompts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'prompts'
  ) then
    alter publication supabase_realtime add table public.prompts;
  end if;
end
$$;
