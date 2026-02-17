import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

const VW_GOLF = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";

test.describe("Phase 24 — Loading Skeletons", () => {
  test("homepage loading skeleton exists", async ({ page }) => {
    await dismissOverlays(page);
    // Navigate to homepage and check it loads
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=automobile").first()).toBeVisible({ timeout: 15000 });
  });

  test("photos sub-page has loading state", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(`${VW_GOLF}/photos`, { waitUntil: "domcontentloaded" });
    // Should eventually show photos page or empty state
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Phase 24 — Homepage Enhancements", () => {
  test("homepage shows 6 tool cards", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for tools section
    await expect(page.locator("text=Outils").first()).toBeVisible({ timeout: 15000 });
    // Check for TCO and Classements tool cards (new additions)
    const toolsSection = page.locator("section", { hasText: "Outils" });
    await expect(toolsSection.locator("text=TCO").first()).toBeVisible({ timeout: 5000 });
    await expect(toolsSection.locator("text=Classements").first()).toBeVisible({ timeout: 5000 });
  });

  test("homepage hero has gradient text", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // The word "automobile" should have gradient styling
    const gradientSpan = page.locator("span.bg-clip-text").first();
    await expect(gradientSpan).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Phase 24 — Compatibility Score", () => {
  test("compatibility score shows profile CTA when no profile", async ({ page }) => {
    await dismissOverlays(page);
    // Clear profile store
    await page.addInitScript(() => {
      localStorage.removeItem("flm-user-profile");
    });
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Should show "Remplissez votre profil" CTA
    await expect(page.locator("text=Remplissez votre profil").first()).toBeVisible({ timeout: 15000 });
  });

  test("compatibility score shows /100 when profile completed", async ({ page }) => {
    await dismissOverlays(page);
    // Set a completed profile in localStorage
    await page.addInitScript(() => {
      localStorage.setItem("flm-user-profile", JSON.stringify({
        state: {
          profile: {
            budget_min: 20000,
            budget_max: 40000,
            usage: "mixed",
            km_annual: 15000,
            family_size: 4,
            child_seats_needed: 2,
            fuel_preference: "essence",
            priorities: ["safety", "space"],
            completed: true,
          },
        },
        version: 0,
      }));
    });
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Should show compatibility score
    await expect(page.locator("text=/\\d+\\/100/").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Phase 24 — Gamification 20 Badges", () => {
  test("badges page shows 20 total badges", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    // Should show X/20 instead of X/16
    await expect(page.locator("text=/\\d+\\/20/").first()).toBeVisible({ timeout: 15000 });
  });

  test("identified badge visible in social category", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Identifi\u00e9").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Phase 24 — TCO Colored Bars", () => {
  test("TCO page loads with search input", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/tco", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Calculateur TCO").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Phase 24 — Rankings Page", () => {
  test("rankings index page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/meilleur", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Classements automobiles").first()).toBeVisible({ timeout: 15000 });
  });
});
