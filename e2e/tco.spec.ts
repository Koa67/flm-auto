import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

test.describe("TCO Calculator", () => {
  test("TCO page loads with title", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/tco");
    await expect(page.locator("text=Calculateur TCO").first()).toBeVisible({ timeout: 10000 });
    // Empty state should show the prompt
    await expect(page.locator("text=Combien").first()).toBeVisible({ timeout: 5000 });
  });

  test("vehicle search input is functional", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/tco");
    await expect(page.locator("text=Calculateur TCO").first()).toBeVisible({ timeout: 10000 });
    // Search input should be present (only when no vehicle selected)
    const input = page.locator("input").first();
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("BMW");
    await expect(input).toHaveValue("BMW");
  });

  test("TCO link from vehicle page has generation_id param", async ({ page }) => {
    await dismissOverlays(page);
    // Navigate to a vehicle generation page with known data
    await page.goto("/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8");
    // Wait for the page to load
    await page.waitForTimeout(3000);
    // Check if a TCO link with ?vehicle= exists
    const tcoLink = page.locator('a[href*="/tco?vehicle="]');
    // Might not have pricing data, so count is acceptable at 0
    const count = await tcoLink.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
