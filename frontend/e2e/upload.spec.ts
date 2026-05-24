import { test, expect } from "@playwright/test";
import path from "path";

const SAMPLE = path.join(process.cwd(), "e2e", "fixtures", "sample.pdf");

test("sign up, upload a PDF, OCR extracts blocks, viewer renders them", async ({ page }) => {
  const email = `e2e.${Date.now()}@example.com`;
  const password = "Test123456!";

  await page.goto("/dashboard");

  // Toggle the form into sign-up mode, then create an account.
  // (Email confirmation is disabled, so sign-up logs us straight in.)
  await page.getByTestId("auth-toggle").click();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();

  // Authenticated dashboard — open the uploader and upload the sample.
  await page.getByTestId("new-document").click();
  await page.setInputFiles('input[type="file"]', SAMPLE);

  // OCR runs in the background; the row becomes a clickable link once "Ready".
  const docLink = page.locator("a.doc-row").first();
  await expect(docLink).toBeVisible({ timeout: 120_000 });
  await docLink.click();
  await expect(page).toHaveURL(/\/documents\//);

  const blocks = page.getByTestId("ocr-block");
  await expect(blocks.first()).toBeVisible({ timeout: 60_000 });
  expect(await blocks.count()).toBeGreaterThan(0);

  // --- Phase 2: translate and verify the bilingual panel ---
  await page.getByTestId("translate-button").click();

  const segments = page.getByTestId("translation-segment");
  await expect(segments.first()).toBeVisible({ timeout: 240_000 });
  expect(await segments.count()).toBeGreaterThan(0);

  // Hovering a translated clause should highlight its source block (shared state).
  await segments.first().hover();
  await expect(page.getByTestId("translation-pane")).toBeVisible();

  // --- Phase 3: sign the document and verify the audit trail ---
  await page.getByTestId("signer-name").fill("Darren Naidoo");
  await page.getByTestId("sign-button").click();

  await expect(page.getByTestId("signed-status")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("signed-status")).toContainText("Darren Naidoo");

  // An audit event should be recorded, and downloads should be available.
  await expect(page.getByTestId("audit-event").first()).toBeVisible();
  await expect(page.getByTestId("download-signed")).toBeVisible();
  await expect(page.getByTestId("download-export")).toBeVisible();

  // --- Phase 4: analyze risks and verify findings ---
  await page.getByTestId("analyze-button").click();
  await expect(page.getByTestId("risk-summary")).toBeVisible({ timeout: 240_000 });
  // Clause explanations should appear in the translation panel.
  await expect(page.getByText("💡", { exact: false }).first()).toBeVisible();
});
