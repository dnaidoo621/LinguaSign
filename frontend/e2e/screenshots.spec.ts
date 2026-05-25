import { test, expect } from "@playwright/test";
import path from "path";

// Positive walkthrough that also captures the product screenshots used in the docs.
// Run on demand:  npx playwright test screenshots.spec.ts
const SAMPLE = path.join(process.cwd(), "e2e", "fixtures", "sample.pdf");
const shot = (name: string) => path.join(process.cwd(), "..", "docs", "screenshots", name);

test("capture product screenshots", async ({ page }) => {
  // Only runs when explicitly requested: CAPTURE=1 npx playwright test screenshots.spec.ts
  test.skip(process.env.CAPTURE !== "1", "set CAPTURE=1 to capture screenshots");
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- Landing (light + dark) ---
  await page.goto("/");
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot("01-landing-light.png"), fullPage: true });
  await page.locator(".theme-toggle").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot("02-landing-dark.png"), fullPage: true });
  await page.locator(".theme-toggle").click();

  // --- Auth ---
  await page.goto("/dashboard");
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot("03-auth.png"), fullPage: true });

  // --- Sign up ---
  await page.getByTestId("auth-toggle").click();
  await page.getByTestId("auth-email").fill(`shots.${Date.now()}@example.com`);
  await page.getByTestId("auth-password").fill("Test123456!");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("new-document")).toBeVisible({ timeout: 20_000 });

  // --- Upload + processing pipeline ---
  await page.getByTestId("new-document").click();
  await page.setInputFiles('input[type="file"]', SAMPLE);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: shot("04-pipeline-running.png"), fullPage: true });
  await expect(page.getByTestId("open-reader")).toBeVisible({ timeout: 420_000 });
  await page.screenshot({ path: shot("05-pipeline-done.png"), fullPage: true });

  // --- Reader (mirrored / margin / pdf) ---
  await page.getByTestId("open-reader").click();
  await page.waitForURL(/\/documents\//);
  await expect(page.getByTestId("reader-clause").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot("06-reader-mirrored.png"), fullPage: true });

  await page.getByRole("button", { name: /^margin$/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot("07-reader-margin.png"), fullPage: true });

  await page.getByRole("button", { name: /^pdf$/i }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot("08-reader-pdf.png"), fullPage: true });

  // --- Signing + audit ---
  await page.getByRole("button", { name: /^mirrored$/i }).click();
  await page.getByTestId("signer-name").fill("Darren Naidoo");
  await page.getByTestId("agree-check").check();
  await page.getByTestId("sign-button").click();
  await expect(page.getByTestId("signed-status")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot("09-signing.png"), fullPage: true });

  // --- Populated dashboard ---
  await page.goto("/dashboard");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot("10-dashboard.png"), fullPage: true });
});
