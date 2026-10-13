-- Share links: a way to let someone without an account (a pastor, a church
-- leader) view and download one album, one category, one service, or the whole
-- gallery.
--
-- The link carries a long random token. Whoever holds the link can see what it
-- covers and nothing else. Visitors are never given database access: the
-- server looks the token up with the secret key and serves only what is in
-- scope.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  -- 32 random bytes, in the link itself. Unguessable.
  token text not null unique check (length(token) >= 40),
  -- Who or what it is for, so admins can tell their links apart.
  label text not null check (length(trim(label)) between 1 and 80),
  -- What it covers. Both empty: the whole gallery. Only a category: that
  -- category across every service. Only a service: everything from it.
  service_id uuid references public.services (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  allow_download boolean not null default true,
  -- Empty means it does not expire.
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  view_count integer not null default 0
);

create index share_links_created_idx on public.share_links (created_at desc);

-- Large videos are opened in Google Drive, which for a visitor with no account
-- means making that one file viewable by anyone holding its Drive link. Each
-- time that is done it is recorded here, so it can be undone when the share
-- link is turned off or expires. Server-only.
create table public.share_file_grants (
  drive_file_id text primary key,
  permission_id text not null,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index share_file_grants_link_idx on public.share_file_grants (share_link_id);

-- Counts a visit without a read-then-write race.
create function public.record_share_view(p_share_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.share_links
  set view_count = view_count + 1, last_viewed_at = now()
  where id = p_share_id
$$;

-- ── Privileges ──────────────────────────────────────────────────────────────

revoke all on public.share_links, public.share_file_grants from anon, authenticated;
grant select, insert, update, delete on public.share_links to authenticated;
grant all on public.share_links, public.share_file_grants to service_role;

revoke all on function public.record_share_view(uuid) from public, anon, authenticated;
grant execute on function public.record_share_view(uuid) to service_role;

alter table public.share_links enable row level security;
alter table public.share_file_grants enable row level security;

-- Only admins create, see and turn off share links. Signed-out visitors never
-- touch this table: the server reads it for them with the secret key.
create policy "Admins manage share links"
  on public.share_links for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
