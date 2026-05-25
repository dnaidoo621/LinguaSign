import { test, expect } from "@playwright/test";

const password = "Test123456!";
const freshEmail = (tag: string) => `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;

test.describe("auth", () => {
  test("sign-up logs in and reveals the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("auth-toggle").click();
    await page.getByTestId("auth-email").fill(freshEmail("auth"));
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("new-document")).toBeVisible({ timeout: 20_000 });
  });

  test("toggles between sign-in and sign-up copy", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/welcome back/i);
    await page.getByTestId("auth-toggle").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/create an account/i);
  });

  test("sign-out returns to the auth screen", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("auth-toggle").click();
    await page.getByTestId("auth-email").fill(freshEmail("auth"));
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("new-document")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page.getByTestId("auth-submit")).toBeVisible();
  });
});
