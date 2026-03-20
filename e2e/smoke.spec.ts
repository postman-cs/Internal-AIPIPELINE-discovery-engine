import { test, expect } from "@playwright/test";

test("login and view dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "daniel@postman.com");
  await page.fill('input[name="password"]', "pipeline123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
  await expect(page.locator("text=Welcome back")).toBeVisible();
});

test("navigate to project", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "daniel@postman.com");
  await page.fill('input[name="password"]', "pipeline123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
  const nflLink = page.locator("text=NFL").first();
  if (await nflLink.isVisible()) {
    await nflLink.click();
    await expect(page.locator("text=NFL")).toBeVisible();
  }
});

test("admiral login redirects to admiral", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "jared@postman.com");
  await page.fill('input[name="password"]', "pipeline123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admiral");
  await expect(page.locator("text=Admiral")).toBeVisible();
});
