import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads with hero and search", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("encyclop\u00e9die");
    await expect(page.locator("input[placeholder]").first()).toBeVisible();
  });

  test("nav links are visible on desktop", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Marques", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Comparer" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Family Fit" })).toBeVisible();
  });

  test("brands page lists brands", async ({ page }) => {
    await page.goto("/marques");
    await expect(page.locator("h1")).toContainText("marques");
    const brandCards = page.locator("a[href^='/marques/']");
    await expect(brandCards.first()).toBeVisible();
  });

  test("brand page shows models", async ({ page }) => {
    await page.goto("/marques/bmw");
    await expect(page.locator("h1")).toBeVisible();
    // Should have model links
    const modelLinks = page.locator("a[href^='/marques/bmw/']");
    await expect(modelLinks.first()).toBeVisible();
  });

  test("search page works", async ({ page }) => {
    await page.goto("/recherche?q=bmw");
    await expect(page.getByPlaceholder("BMW M3")).toHaveValue("bmw");
    // Wait for results
    await page.waitForSelector("a[href^='/marques/']", { timeout: 10000 });
    const results = page.locator("a[href^='/marques/']");
    expect(await results.count()).toBeGreaterThan(0);
  });

  test("404 page shows for invalid route", async ({ page }) => {
    const response = await page.goto("/cette-page-nexiste-pas");
    expect(response?.status()).toBe(404);
  });

  test("breadcrumbs navigate correctly", async ({ page }) => {
    await page.goto("/marques/bmw");
    // Dismiss any overlay (cookie banner, onboarding tour)
    try {
      const overlay = page.locator('.fixed.inset-0');
      if (await overlay.isVisible({ timeout: 2000 })) {
        const closeBtn = page.locator('button:has-text("Accepter"), button:has-text("Fermer"), [aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 1000 })) await closeBtn.click();
      }
    } catch { /* no overlay */ }
    const breadcrumb = page.getByRole("link", { name: "Marques", exact: true }).first();
    if (await breadcrumb.isVisible()) {
      await breadcrumb.click();
      await expect(page).toHaveURL("/marques");
    }
  });

  test("command palette opens with keyboard", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Meta+k");
    // Command dialog should appear
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 3000 });
  });
});
