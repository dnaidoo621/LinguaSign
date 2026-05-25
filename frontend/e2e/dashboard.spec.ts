import { test, expect, type Page } from "@playwright/test";

async function signUp(page: Page) {
  const email = `dash.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/dashboard");
  await page.getByTestId("auth-toggle").click();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill("Test123456!");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("new-document")).toBeVisible({ timeout: 20_000 });
}

test.describe("dashboard", () => {
  test("empty workspace shows the stat ledger and empty list", async ({ page }) => {
    await signUp(page);
    await expect(page.getByRole("heading", { name: /your documents/i })).toBeVisible();
    await expect(page.locator(".stat")).toHaveCount(4);
    await expect(page.getByText(/no documents match/i)).toBeVisible();
  });

  test("New document reveals the uploader", async ({ page }) => {
    await signUp(page);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await page.getByTestId("new-document").click();
    await expect(page.getByText(/drag a pdf here/i)).toBeVisible();
  });

  test("filter tabs render", async ({ page }) => {
    await signUp(page);
    await expect(page.locator(".filter-tabs .tab")).toHaveCount(4);
  });
});
