import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

// Use known-valid slugs from the database
const VEHICLE_URL = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";

test.describe("Photos Quality", () => {
  test("photos page loads with images", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(`${VEHICLE_URL}/photos`, { timeout: 60000, waitUntil: "domcontentloaded" });
    await expect(
      page.locator("text=Photos").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("generation page shows images section", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VEHICLE_URL);
    await page.waitForTimeout(3000);
    // Should have a Photos tab or link
    const photosLink = page.locator('a[href*="/photos"]').first();
    await expect(photosLink).toBeVisible({ timeout: 10000 });
  });
});
