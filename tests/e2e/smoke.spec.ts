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
  await expect(page).toHaveURL(/\/login$/);
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
