-- ── The running "who uploaded what" post ────────────────────────────────────
-- One Telegram message per service lists who uploaded what, and is edited as
-- more uploads come in. Editing needs the message's ID, and the text last sent
-- tells us whether there is anything new to show.

alter table public.notification_log
  add column telegram_chat_id bigint,
  add column telegram_message_id bigint,
  add column body text;
