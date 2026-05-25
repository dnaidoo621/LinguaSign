import { test, expect } from "@playwright/test";
import path from "path";

// Negative / edge-case coverage. These are fast — none trigger the LLM pipeline.
test.describe("negative + edge cases", () => {
  test("dashboard requires authentication", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("auth-submit")).toBeVisible();
    await expect(page.getByTestId("new-document")).toHaveCount(0);
  });

  test("wrong credentials surface an error", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("auth-email").fill(`nobody.${Date.now()}@example.com`);
    await page.getByTestId("auth-password").fill("definitely-wrong-pw");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible({ timeout: 20_000 });
  });

  test("reader requires authentication", async ({ page }) => {
    await page.goto("/documents/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("main")).toContainText(/sign in/i);
  });

  test("theme toggle persists across reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(".theme-toggle").click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(afterReload).toBe(theme);
    expect(["light", "dark"]).toContain(afterReload);
  });

  test("non-PDF upload is rejected client-side", async ({ page }) => {
    const email = `neg.${Date.now()}@example.com`;
    await page.goto("/dashboard");
    await page.getByTestId("auth-toggle").click();
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill("Test123456!");
    await page.getByTestId("auth-submit").click();

    await page.getByTestId("new-document").click();
    await page.setInputFiles('input[type="file"]', path.join(process.cwd(), "e2e", "fixtures", "not-a-pdf.txt"));
    await expect(page.getByText(/please choose a pdf/i)).toBeVisible({ timeout: 15_000 });
  });
});
