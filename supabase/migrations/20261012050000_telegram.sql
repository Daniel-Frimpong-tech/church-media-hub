-- Phase 6: Telegram bot.

-- Each person's linked Telegram account. Used to tag them in group messages.
alter table public.profiles
  add column telegram_user_id bigint unique,
  add column telegram_name text;

-- ── App-wide settings ───────────────────────────────────────────────────────
-- A single row. Server-only: read and written with the secret key.

create table public.app_settings (
  id boolean primary key default true check (id),
  -- The media team's Telegram group, once an admin has linked it.
  telegram_chat_id bigint,
  telegram_chat_title text,
  telegram_linked_by uuid references public.profiles (id) on delete set null,
  telegram_linked_at timestamptz
);

insert into public.app_settings (id) values (true);

-- ── One-time links the bot hands out ────────────────────────────────────────
-- /join and /linkgroup reply with a link containing a random token. Only the
-- token's SHA-256 hash is stored, so reading this table does not reveal a
-- usable link. Server-only.

create type public.telegram_link_kind as enum ('person', 'group');

create table public.telegram_link_tokens (
  token_hash text primary key,
  kind public.telegram_link_kind not null,
  -- For 'person': the Telegram user who sent /join.
  telegram_user_id bigint,
  -- For 'group': the chat /linkgroup was sent in.
  telegram_chat_id bigint,
  -- Shown on the confirmation page so the person can check it is theirs.
  display_name text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'person' and telegram_user_id is not null)
    or (kind = 'group' and telegram_chat_id is not null)
  )
);

-- ── What has already been announced ─────────────────────────────────────────
-- Scheduled jobs run repeatedly. The unique key makes "send this once" safe:
-- whoever inserts the row first sends the message; everyone else skips it.
-- Server-only.

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  dedupe_key text not null unique,
  service_id uuid references public.services (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index notification_log_service_idx on public.notification_log (service_id);

-- ── Privileges ──────────────────────────────────────────────────────────────

revoke all on public.app_settings, public.telegram_link_tokens,
  public.notification_log from anon, authenticated;
grant all on public.app_settings, public.telegram_link_tokens,
  public.notification_log to service_role;
-- Linking a Telegram account updates the person's own profile; the server
-- does that with the secret key after they confirm.
grant select, update on public.profiles to service_role;

alter table public.app_settings enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.notification_log enable row level security;
