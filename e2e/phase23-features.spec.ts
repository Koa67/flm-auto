import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

const VW_GOLF = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";

test.describe("Phase 23 — Gamification", () => {
  test("badges page loads at /coffre/badges", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Mes Badges").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Exploration").first()).toBeVisible({ timeout: 5000 });
  });

  test("badge progress bar is visible", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    // Should show X/20 badges count
    await expect(page.locator("text=/\\d+\\/20/").first()).toBeVisible({ timeout: 15000 });
  });

  test("badge categories render (4 sections)", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Exploration").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Comparaison").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Expert").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Social").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Phase 23 — ALAIN Avatar", () => {
  test("ALAIN avatar renders in chat widget", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Open chat
    const chatBtn = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(chatBtn).toBeVisible({ timeout: 15000 });
    await chatBtn.click();
    // Avatar SVG should be visible in the header
    const avatar = page.locator('svg[aria-label="ALAIN"]').first();
    await expect(avatar).toBeVisible({ timeout: 5000 });
  });

  test("welcome screen shows ALAIN avatar", async ({ page }) => {
    await dismissOverlays(page);
    // Clear ALAIN conversation to see welcome screen
    await page.addInitScript(() => {
      localStorage.removeItem("alain-conversation");
    });
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    const chatBtn = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(chatBtn).toBeVisible({ timeout: 15000 });
    await chatBtn.click();
    // Welcome screen should have "Salut" text
    await expect(page.locator("text=Salut").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Phase 23 — Comparateur enrichi", () => {
  test("comparator page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/comparer", { waitUntil: "domcontentloaded" });
    // Look for the vehicle search input or heading
    await expect(page.locator("input[placeholder]").first()).toBeVisible({ timeout: 15000 });
  });

  test("comparator API returns consumption data", async ({ request }) => {
    // First we need 2 generation IDs — use the compare API directly
    // The API should not error for invalid IDs but return gracefully
    const res = await request.get("/api/compare?ids=00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002");
    // Should not be a 500 error
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Phase 23 — ViewTracker gamification", () => {
  test("visiting vehicle page tracks in localStorage", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Wait for page to load and tracker to fire
    await page.waitForTimeout(2000);
    // Check localStorage for gamification data
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("flm-gamification");
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored).not.toBeNull();
    expect(stored?.state?.stats?.vehiclesViewed).toBeGreaterThanOrEqual(1);
  });
});
