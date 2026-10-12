-- Phase 7: recurring services and scheduled jobs.

-- ── Recurring services ──────────────────────────────────────────────────────
-- "Every Sunday at 10:00". A scheduled job creates the actual service, with
-- its Drive folders, a few days ahead.

create table public.service_series (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- 0 = Sunday … 6 = Saturday, in the church's time zone.
  weekday smallint not null check (weekday between 0 and 6),
  -- Wall-clock time in the church's time zone.
  local_time time not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.services
  add column series_id uuid references public.service_series (id) on delete set null,
  -- The occurrence this service was created for. Stays the same if an admin
  -- later moves the service, so the job does not create a duplicate.
  add column series_slot timestamptz;

create unique index services_series_slot_key
  on public.services (series_id, series_slot)
  where series_id is not null;

-- Occurrences an admin deleted on purpose. The job leaves these alone.
create table public.service_series_skips (
  series_id uuid not null references public.service_series (id) on delete cascade,
  series_slot timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (series_id, series_slot)
);

-- When the scheduled jobs last ran, shown to admins so a silent failure of
-- the scheduler is visible.
alter table public.app_settings
  add column last_job_run_at timestamptz,
  add column last_job_result jsonb;

-- ── Privileges and row level security ───────────────────────────────────────

revoke all on public.service_series, public.service_series_skips
  from anon, authenticated;
grant select, insert, update, delete
  on public.service_series, public.service_series_skips to authenticated;
grant all on public.service_series, public.service_series_skips,
  public.services, public.service_folders, public.uploads, public.categories
  to service_role;

alter table public.service_series enable row level security;
alter table public.service_series_skips enable row level security;

create policy "Active people can read recurring services"
  on public.service_series for select to authenticated
  using ((select private.current_app_role()) is not null);

create policy "Admins manage recurring services"
  on public.service_series for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Admins manage skipped occurrences"
  on public.service_series_skips for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
