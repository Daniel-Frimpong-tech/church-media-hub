-- Phase 3: uploads, and which teams receive which categories.

create type public.upload_status as enum ('uploading', 'complete', 'failed');
create type public.upload_source as enum ('app', 'import');

-- ── Category → receiving team ───────────────────────────────────────────────
-- Decides which categories a viewer can see, and (from phase 5) each team's
-- delivery deadline.

create table public.category_teams (
  category_id uuid not null references public.categories (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  -- Hours after the service starts by which the team should have the content.
  deadline_hours integer not null default 24 check (deadline_hours >= 0),
  created_at timestamptz not null default now(),
  primary key (category_id, team_id)
);

create index category_teams_team_id_idx on public.category_teams (team_id);

-- ── Uploads ─────────────────────────────────────────────────────────────────
-- One row per file. The bytes live in Google Drive; this is the record of who
-- uploaded what, when, and where it went.

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  uploaded_by uuid references public.profiles (id) on delete set null,
  -- Set once Google confirms the file exists.
  drive_file_id text unique,
  file_name text not null check (length(file_name) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  status public.upload_status not null default 'uploading',
  -- 'import' is reserved for the Google Photos Takeout import.
  source public.upload_source not null default 'app',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'complete') = (drive_file_id is not null and completed_at is not null))
);

create index uploads_service_category_idx
  on public.uploads (service_id, category_id, created_at desc);
create index uploads_uploaded_by_idx on public.uploads (uploaded_by);

-- ── Who can see a category ──────────────────────────────────────────────────

create function private.can_view_category(target_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.current_app_role()
    when 'admin' then true
    when 'member' then true
    when 'viewer' then exists (
      select 1
      from public.category_teams ct
      join public.team_members tm on tm.team_id = ct.team_id
      where ct.category_id = target_category_id
        and tm.profile_id = (select auth.uid())
    )
    else false
  end
$$;

-- ── Privileges ──────────────────────────────────────────────────────────────

revoke all on public.category_teams, public.uploads from anon, authenticated;

grant select, insert, update, delete on public.category_teams to authenticated;
-- Marking an upload complete is done by the server after checking with Google,
-- so signed-in users get no UPDATE on uploads.
grant select, insert, delete on public.uploads to authenticated;
grant all on public.uploads to service_role;

revoke all on function private.can_view_category(uuid) from public, anon;
grant execute on function private.can_view_category(uuid) to authenticated;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.category_teams enable row level security;
alter table public.uploads enable row level security;

create policy "Active people can read category teams"
  on public.category_teams for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage category teams"
  on public.category_teams for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Admins and members see every upload. Viewers see only finished uploads in
-- categories delivered to one of their teams.
create policy "People can read uploads they are allowed to see"
  on public.uploads for select to authenticated
  using (
    private.can_view_category(category_id)
    and (
      status = 'complete'
      or (select private.current_app_role()) in ('admin', 'member')
    )
  );

-- Admins and members can start an upload, only in their own name.
create policy "Admins and members can start uploads"
  on public.uploads for insert to authenticated
  with check (
    (select private.current_app_role()) in ('admin', 'member')
    and uploaded_by = (select auth.uid())
    and status = 'uploading'
    and drive_file_id is null
  );

create policy "Admins can delete upload records"
  on public.uploads for delete to authenticated
  using ((select private.is_admin()));
