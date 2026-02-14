import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

test.describe("Smart Filters", () => {
  test("recherche page has filter functionality", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche");
    await expect(page.locator("h1")).toContainText("Recherche");
    const input = page.getByPlaceholder("BMW M3");
    await expect(input).toBeVisible();
  });

  test("search updates URL params", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche");
    const input = page.getByPlaceholder("BMW M3");
    await input.click();
    await input.fill("audi a4");
    // router.replace uses replaceState — use toHaveURL (polls) instead of waitForURL (waits for navigation)
    await expect(page).toHaveURL(/recherche\?q=audi/, { timeout: 10000 });
  });

  test("search results display with correct structure", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche?q=porsche");
    // Wait for results to load
    await page.waitForSelector("a[href^='/marques/']", { timeout: 20000 });
    const results = page.locator("a[href^='/marques/']");
    expect(await results.count()).toBeGreaterThan(0);
    // Each result should have brand name
    await expect(results.first()).toContainText("Porsche");
  });

  test("empty search shows prompt", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche");
    // Should show "Tapez au moins 2 caractères"
    await expect(page.locator("text=2 caract")).toBeVisible();
  });
});
