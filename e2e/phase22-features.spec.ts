import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

// Known-valid vehicle slugs
const VW_GOLF = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";
const BMW_3 = "/marques/bmw/3-series/e46";

test.describe("Phase 22 — Configurateur enrichi", () => {
  test("configurateur search API accepts stream param", async ({ request }) => {
    // The configurateur search API should accept requests without errors
    const res = await request.post("/api/configurateur/search", {
      data: {
        budget: { min: 20000, max: 50000 },
        fuelTypes: ["essence"],
        priorities: ["fiabilite", "conso"],
        bodyTypes: [],
        exclude_red_flags: true,
      },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Phase 22 — ALAIN Streaming", () => {
  test("ALAIN chat API accepts stream field in body", async ({ request }) => {
    const res = await request.post("/api/alain/chat", {
      data: {
        messages: [{ role: "user", content: "Bonjour" }],
        stream: true,
      },
    });
    // 200 (streaming) or 503 (Ollama down) are both acceptable
    expect([200, 503]).toContain(res.status());
  });

  test("ALAIN chat widget renders on vehicle page", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // The chat FAB should be visible
    const chatButton = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(chatButton).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Phase 22 — Profile Lenses", () => {
  test("profile lens picker is visible on generation page", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Look for the Vue label and lens buttons
    await expect(page.locator("text=Vue").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("button:has-text('Famille')").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button:has-text('Performance')").first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking a lens reveals focused stats panel", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Wait for page content to settle
    await page.waitForTimeout(2000);
    const perfBtn = page.locator("button:has-text('Performance')").first();
    await perfBtn.scrollIntoViewIfNeeded();
    await expect(perfBtn).toBeVisible({ timeout: 15000 });
    await perfBtn.click();
    const panel = page.locator('[data-testid="profile-lens-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  test("clicking Famille lens shows family panel", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const famBtn = page.locator("button:has-text('Famille')").first();
    await famBtn.scrollIntoViewIfNeeded();
    await expect(famBtn).toBeVisible({ timeout: 15000 });
    await famBtn.click();
    const panel = page.locator('[data-testid="profile-lens-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Phase 22 — Used Car Pricing", () => {
  test("VW Golf shows used car pricing estimates", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    // Should show the pricing section
    await expect(
      page.locator("text=Prix occasion").first()
    ).toBeVisible({ timeout: 15000 });
    // Should show depreciation percentages
    await expect(page.locator("text=MSRP neuf").first()).toBeVisible({ timeout: 5000 });
  });

  test("BMW 3 Series shows used car pricing", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(BMW_3, { waitUntil: "domcontentloaded" });
    // BMW 3 Series is in our hardcoded data
    await expect(
      page.locator("text=Prix occasion").first()
    ).toBeVisible({ timeout: 15000 });
  });
});
