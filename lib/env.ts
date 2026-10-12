// Read lazily (inside functions) so a missing variable fails the request that
// needs it with a clear message, instead of failing the whole build.

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. See .env.example for what it is and where to find it.`,
    );
  }
  return value;
}

// NEXT_PUBLIC_ variables must be written out in full for Next.js to inline them.
export function supabaseUrl(): string {
  return required(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
}

export function supabasePublishableKey(): string {
  return required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
}

// ── Server-only values. Never import these into a Client Component. ──────────

export function supabaseSecretKey(): string {
  return required(process.env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY");
}

export function googleClientId(): string {
  return required(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
}

export function googleClientSecret(): string {
  return required(process.env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
}

export function tokenEncryptionKey(): string {
  return required(process.env.TOKEN_ENCRYPTION_KEY, "TOKEN_ENCRYPTION_KEY");
}

/** The app's public address, used for links in Telegram messages. */
export function appUrl(): string {
  return required(process.env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

// Telegram and scheduled jobs are optional: the app works without them, so
// these return null instead of throwing when they are not set.

export function telegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export function telegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET || null;
}

export function cronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}
