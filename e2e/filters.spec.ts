import { test, expect } from "@playwright/test";

test.describe("Smart Filters", () => {
  test("recherche page has filter functionality", async ({ page }) => {
    await page.goto("/recherche");
    await expect(page.locator("h1")).toContainText("Recherche");
    const input = page.getByPlaceholder("BMW M3");
    await expect(input).toBeVisible();
  });

  test("search updates URL params", async ({ page }) => {
    await page.goto("/recherche");
    const input = page.getByPlaceholder("BMW M3");
    await input.fill("audi a4");
    // Wait for URL to update
    await page.waitForURL(/recherche\?q=audi/, { timeout: 5000 });
    expect(page.url()).toContain("q=audi");
  });

  test("search results display with correct structure", async ({ page }) => {
    await page.goto("/recherche?q=porsche");
    // Wait for results to load
    await page.waitForSelector("a[href^='/marques/']", { timeout: 10000 });
    const results = page.locator("a[href^='/marques/']");
    expect(await results.count()).toBeGreaterThan(0);
    // Each result should have brand name
    await expect(results.first()).toContainText("Porsche");
  });

  test("empty search shows prompt", async ({ page }) => {
    await page.goto("/recherche");
    // Should show "Tapez au moins 2 caractères"
    await expect(page.locator("text=2 caract")).toBeVisible();
  });
});
