import { test, expect } from "@playwright/test";

test.describe("landing", () => {
  test("renders the hero, proof points, and disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/understand/i);
    await expect(page.locator(".morph-stage")).toBeVisible();
    await expect(page.locator(".proof-card")).toHaveCount(3);
    await expect(page.getByText(/not certified legal translation/i)).toBeVisible();
  });

  test("primary CTA goes to the app", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /upload a document/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("top-bar Documents link navigates to the dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^documents$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
