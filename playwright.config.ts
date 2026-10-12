import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;
const fakeGooglePort = 3200;
const fakeGoogleUrl = `http://localhost:${fakeGooglePort}`;

// Set by CI after `supabase start`. With these, the app is pointed at the
// local Supabase and a fake Google Drive, and the main-flow test runs. Without
// them only the signed-out smoke tests run, against placeholder values.
const localSupabase: Record<string, string> = process.env.E2E_SUPABASE_URL
  ? {
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SECRET_KEY: process.env.E2E_SUPABASE_SERVICE_KEY ?? "",
    }
  : {};

// Test-only values. They take precedence over .env.local, so a local run can
// never message the real Telegram bot or use the real secrets.
// The encryption key is 32 bytes of "0123456789abcdef…".
const testEnv: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: baseURL,
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_WEBHOOK_SECRET: "e2e-webhook-secret",
  CRON_SECRET: "e2e-cron-secret",
  E2E_FAKE_GOOGLE_URL: fakeGoogleUrl,
  TOKEN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  GOOGLE_CLIENT_ID: "e2e-client-id",
  GOOGLE_CLIENT_SECRET: "e2e-client-secret",
  ...localSupabase,
};
// The test process needs the same values (to encrypt the fake token, and to
// reach the fake Drive).
Object.assign(process.env, testEnv);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Mobile first: most uploads come from phones right after service.
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      command: "node tests/e2e/fake-google.mjs",
      url: `${fakeGoogleUrl}/health`,
      env: { FAKE_GOOGLE_PORT: String(fakeGooglePort) },
      reuseExistingServer: !process.env.CI,
    },
    {
      // CI tests the production build; locally the dev server is faster.
      command: process.env.CI
        ? `npm run build && npm run start -- --port ${port}`
        : `npm run dev -- --port ${port}`,
      url: `${baseURL}/login`,
      env: testEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
