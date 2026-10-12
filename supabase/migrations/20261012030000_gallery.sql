-- Phase 4: gallery support.

-- Gallery and search list finished uploads newest first.
create index uploads_complete_recent_idx
  on public.uploads (completed_at desc)
  where status = 'complete';

-- ── Drive access granted to individual people ───────────────────────────────
-- Large files (videos) are opened in Google Drive itself, so the person's own
-- Google account needs read access to that category's folder. Each grant is
-- recorded here so it can be taken away when their access changes.
-- No signed-in user can read this table: only server code with the secret key.

create table public.drive_grants (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  drive_folder_id text not null,
  -- Google's ID for the permission, needed to remove it again.
  permission_id text not null,
  created_at timestamptz not null default now(),
  -- Set when access should be removed. Cleared once Google confirms removal
  -- (the row is deleted), so a failed removal is retried later.
  revoke_requested_at timestamptz,
  primary key (profile_id, drive_folder_id)
);

revoke all on public.drive_grants from anon, authenticated;
grant all on public.drive_grants to service_role;

alter table public.drive_grants enable row level security;
