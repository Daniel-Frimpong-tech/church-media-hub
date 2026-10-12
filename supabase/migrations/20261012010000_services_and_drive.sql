-- Phase 2: categories, services, their Google Drive folders, and the church
-- Google account connection.

create type public.drive_folder_status as enum ('pending', 'ready', 'failed');
create type public.google_connection_status as enum ('connected', 'expired');

-- ── Categories ──────────────────────────────────────────────────────────────
-- Kept in a table so admins can add or retire them without a code change.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  -- Retired categories stay so old uploads keep their category.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categories (slug, name, sort_order) values
  ('baptism', 'Baptism', 10),
  ('preacher', 'Preacher', 20),
  ('fellowship', 'Fellowship', 30),
  ('videos', 'Videos', 40);

-- ── Services ────────────────────────────────────────────────────────────────

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  starts_at timestamptz not null,
  -- The service's folder in the church Google Drive, once it has been created.
  drive_folder_id text,
  drive_folder_status public.drive_folder_status not null default 'pending',
  drive_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index services_starts_at_idx on public.services (starts_at);

-- One Drive subfolder per category, per service.
create table public.service_folders (
  service_id uuid not null references public.services (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  drive_folder_id text not null,
  created_at timestamptz not null default now(),
  primary key (service_id, category_id)
);

-- ── Church Google account ───────────────────────────────────────────────────
-- A single row. It holds the encrypted refresh token, so no signed-in user can
-- read it at all: only server code using the secret key.

create table public.google_connection (
  id boolean primary key default true check (id),
  account_email text not null,
  refresh_token_encrypted text not null,
  -- The top-level "RCW Media" folder every service folder lives in.
  root_folder_id text not null,
  status public.google_connection_status not null default 'connected',
  last_error text,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now()
);

-- ── Privileges ──────────────────────────────────────────────────────────────

revoke all on public.categories, public.services, public.service_folders,
  public.google_connection from anon, authenticated;

grant select, insert, update, delete
  on public.categories, public.services, public.service_folders
  to authenticated;

grant all on public.google_connection to service_role;

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.service_folders enable row level security;
-- Enabled with no policies: nothing gets through except the secret key.
alter table public.google_connection enable row level security;

create policy "Active people can read categories"
  on public.categories for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage categories"
  on public.categories for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Active people can read services"
  on public.services for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage services"
  on public.services for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Active people can read service folders"
  on public.service_folders for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage service folders"
  on public.service_folders for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
