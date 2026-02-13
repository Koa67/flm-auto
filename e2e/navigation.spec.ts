import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads with hero and search", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("encyclopédie");
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
    // Seed localStorage to skip onboarding tour + cookie banner
    await page.addInitScript(() => {
      localStorage.setItem("flm-onboarding-done", "true");
      localStorage.setItem("flm-cookie-consent", "accepted");
    });
    await page.goto("/marques/bmw");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

    // Verify the back-link exists and has the correct href
    const breadcrumb = page.locator('main a[href="/marques"]').first();
    await expect(breadcrumb).toBeVisible({ timeout: 3000 });
    await expect(breadcrumb).toHaveAttribute("href", "/marques");
  });

  test("command palette opens with keyboard", async ({ page }) => {
    // Skip on mobile — no keyboard shortcut support
    test.skip(page.viewportSize()!.width < 768, "No keyboard shortcut on mobile");
    await page.goto("/");
    await page.keyboard.press("Meta+k");
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 3000 });
  });

  test("mobile search button is accessible", async ({ page }) => {
    test.skip(page.viewportSize()!.width >= 768, "Desktop uses keyboard shortcut");
    await page.goto("/");

    // Mobile search button should be visible with proper aria-label
    const searchBtn = page.getByRole("button", { name: "Rechercher", exact: true });
    await expect(searchBtn).toBeVisible();
    await expect(searchBtn).toBeEnabled();
  });
});
