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
  updated_at timestamptz not null default now(),
  constraint prompts_title_length check (char_length(title) <= 200),
  constraint prompts_description_length check (char_length(description) <= 4000),
  constraint prompts_body_length check (char_length(body) <= 100000),
  constraint prompts_folder_length check (char_length(folder) <= 100),
  constraint prompts_tags_limit check (cardinality(tags) <= 20 and char_length(array_to_string(tags, '')) <= 2000),
  constraint prompts_ai_targets_limit check (cardinality(ai_targets) <= 10 and char_length(array_to_string(ai_targets, '')) <= 1000),
  constraint prompts_variables_limit check (jsonb_typeof(variables) = 'array' and pg_column_size(variables) <= 65536),
  constraint prompts_use_count_range check (use_count between 0 and 100000000),
  constraint prompts_version_range check (version between 1 and 1000000)
);

create index if not exists prompts_user_updated_idx
  on public.prompts(user_id, updated_at desc);

create index if not exists prompts_user_active_updated_idx
  on public.prompts(user_id, updated_at desc)
  where deleted_at is null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enforce_prompt_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := (select auth.uid());
  prompt_count integer;
begin
  if requester is null or requester <> new.user_id then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  select count(*) into prompt_count
  from public.prompts
  where user_id = new.user_id;

  if prompt_count >= 500 then
    raise exception using errcode = 'P0001', message = 'prompt limit reached';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_prompt_insert_limit() from public, anon, authenticated;

drop trigger if exists enforce_prompt_insert_limit on public.prompts;
create trigger enforce_prompt_insert_limit
before insert on public.prompts
for each row execute function private.enforce_prompt_insert_limit();

alter table public.prompts enable row level security;

revoke all on public.prompts from public;
revoke all on public.prompts from anon;
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
