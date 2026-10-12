import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "RCW Media" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("protected pages cannot be opened while signed out", async ({ page }) => {
  await page.goto("/admin/people");
  // Sent to sign in, remembering where they were going.
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fpeople$/);
});

test("the Telegram webhook rejects calls without the secret", async ({ request }) => {
  const update = { message: { message_id: 1, text: "hello", chat: { id: 1, type: "private" }, from: { id: 1 } } };

  const missing = await request.post("/api/telegram/webhook", { data: update });
  expect(missing.status()).toBe(401);

  const wrong = await request.post("/api/telegram/webhook", {
    data: update,
    headers: { "X-Telegram-Bot-Api-Secret-Token": "not-the-secret" },
  });
  expect(wrong.status()).toBe(401);
});

test("the Telegram webhook accepts calls with the secret", async ({ request }) => {
  // An ordinary chat message: authenticated, then ignored.
  const response = await request.post("/api/telegram/webhook", {
    data: { message: { message_id: 1, text: "hello", chat: { id: 1, type: "private" }, from: { id: 1 } } },
    headers: { "X-Telegram-Bot-Api-Secret-Token": process.env.TELEGRAM_WEBHOOK_SECRET ?? "" },
  });
  expect(response.status()).toBe(200);
});

test("scheduled-job endpoints reject calls without the secret", async ({ request }) => {
  expect((await request.post("/api/cron/run")).status()).toBe(401);
  const wrong = await request.post("/api/cron/run", {
    headers: { Authorization: "Bearer not-the-secret" },
  });
  expect(wrong.status()).toBe(401);
});

test("API routes answer signed-out calls with an error, not the login page", async ({
  request,
  baseURL,
}) => {
  for (const path of ["/api/uploads/session", "/api/uploads/status", "/api/uploads/complete"]) {
    const response = await request.post(path, {
      data: {},
      headers: { Origin: baseURL ?? "" },
      maxRedirects: 0,
    });
    expect(response.status(), path).toBe(401);
    expect((await response.json()).error.code).toBe("signed_out");
  }

  const thumbnail = await request.get(
    "/api/thumb/986a261f-e7e0-4f77-b376-10f477daa7d0",
    { maxRedirects: 0 },
  );
  expect(thumbnail.status()).toBe(401);
});

test("the login page explains when an account is not invited", async ({
  page,
}) => {
  await page.goto("/login?error=not_invited");
  // Next.js adds its own hidden role="alert" element, so match ours by text.
  await expect(
    page.getByRole("alert").filter({ hasText: "has not been invited" }),
  ).toBeVisible();
});
