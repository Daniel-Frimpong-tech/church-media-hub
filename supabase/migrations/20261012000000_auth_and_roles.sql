-- Phase 1: people, roles, invites and teams.
--
-- Access model
--   admin   manages everything
--   member  media team: uploads and completes tasks
--   viewer  receiving teams: sees only what is assigned to their team
--
-- Sign-up is invite only. The gate is a trigger on auth.users, so it holds no
-- matter how someone tries to create an account.

-- Helper functions live here. Supabase does not expose this schema through the API.
create schema if not exists private;

create type public.app_role as enum ('admin', 'member', 'viewer');
create type public.team_kind as enum ('media', 'receiving');

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  kind public.team_kind not null default 'receiving',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Always stored lowercase so lookups never depend on how it was typed.
  email text not null unique check (email = lower(email)),
  full_name text not null,
  avatar_url text,
  role public.app_role not null default 'member',
  -- People are deactivated, never deleted, so upload history keeps its author.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.invites (
  email text primary key
    check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.app_role not null default 'member',
  team_id uuid references public.teams (id) on delete set null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create index team_members_profile_id_idx on public.team_members (profile_id);

-- ── Role helpers used by the policies ───────────────────────────────────────
-- security definer so they can read profiles without tripping the profiles
-- policy that calls them. Deactivated people have no role at all.

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and active
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false)
$$;

-- ── Invite gate ─────────────────────────────────────────────────────────────
-- Runs inside the same transaction that creates the auth user. Raising here
-- rolls the sign-up back, so an uninvited Google account never gets a user row.

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.invites;
begin
  select * into invite from public.invites where email = lower(new.email);

  if not found then
    raise exception 'not_invited';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    lower(new.email),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    invite.role
  );

  if invite.team_id is not null then
    insert into public.team_members (team_id, profile_id)
    values (invite.team_id, new.id)
    on conflict do nothing;
  end if;

  update public.invites set accepted_at = now() where email = invite.email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Never lose the last admin ───────────────────────────────────────────────

create function private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  losing_admin boolean;
begin
  if tg_op = 'DELETE' then
    losing_admin := old.role = 'admin' and old.active;
  else
    losing_admin := old.role = 'admin' and old.active
      and (new.role <> 'admin' or not new.active);
  end if;

  if losing_admin and not exists (
    select 1 from public.profiles
    where role = 'admin' and active and id <> old.id
  ) then
    raise exception 'last_admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger protect_last_admin
  before update or delete on public.profiles
  for each row execute function private.protect_last_admin();

-- ── Privileges ──────────────────────────────────────────────────────────────
-- Signed-out visitors get nothing. Signed-in users get table access, and the
-- row level security policies below decide which rows.

revoke all on public.teams, public.profiles, public.invites, public.team_members
  from anon;

grant select, insert, update, delete
  on public.teams, public.invites, public.team_members
  to authenticated;
-- Profiles are created by the invite trigger and never deleted.
grant select, update on public.profiles to authenticated;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.current_app_role(), private.is_admin()
  to authenticated;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.team_members enable row level security;

-- Any active person can see who is on the team and which teams exist.
create policy "Active people can read profiles"
  on public.profiles for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Active people can read teams"
  on public.teams for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage teams"
  on public.teams for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Active people can read team members"
  on public.team_members for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage team members"
  on public.team_members for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Invites hold email addresses of people who have not joined yet: admins only.
create policy "Admins manage invites"
  on public.invites for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
