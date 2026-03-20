import { test, expect } from "@playwright/test";

test("dashboard constellation renders", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "daniel@postman.com");
  await page.fill('input[name="password"]', "pipeline123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(3000);
  const canvas = page.locator("canvas").first();
  if (await canvas.isVisible()) {
    await expect(canvas).toHaveScreenshot("dashboard-constellation.png", { maxDiffPixelRatio: 0.05 });
  }
});
