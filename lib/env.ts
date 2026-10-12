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

/**
 * The app's public address, used for links in Telegram messages and for the
 * webhook Telegram calls.
 *
 * On the live Vercel deployment this is taken from Vercel itself, so it is
 * right even if NEXT_PUBLIC_APP_URL was left pointing at localhost. Set
 * NEXT_PUBLIC_APP_URL to a real https address only to override it, for example
 * after adding a custom domain.
 */
export function appUrl(): string {
  return resolveAppUrl({
    configured: process.env.NEXT_PUBLIC_APP_URL,
    vercelEnv: process.env.VERCEL_ENV,
    vercelProductionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  });
}

export function resolveAppUrl(input: {
  configured: string | undefined;
  vercelEnv: string | undefined;
  vercelProductionHost: string | undefined;
}): string {
  const configured = input.configured?.trim().replace(/\/+$/, "") ?? "";
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(configured);

  if (
    input.vercelEnv === "production" &&
    input.vercelProductionHost &&
    (!configured || isLocal)
  ) {
    return `https://${input.vercelProductionHost}`;
  }
  return required(configured || undefined, "NEXT_PUBLIC_APP_URL");
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
