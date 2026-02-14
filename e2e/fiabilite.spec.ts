import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

// Use known-valid slugs from the database
const VEHICLE_URL = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";

test.describe("Fiabilité Page", () => {
  test("fiabilite page loads with title", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(`${VEHICLE_URL}/fiabilite`);
    await expect(
      page.locator("text=Fiabilité").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("fiabilite page shows reliability score", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(`${VEHICLE_URL}/fiabilite`);
    await expect(
      page.locator("text=Score de fiabilité").first()
    ).toBeVisible({ timeout: 15000 });
    // Score should show /100
    await expect(
      page.locator("text=/ 100").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("fiabilite link appears in vehicle nav", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VEHICLE_URL);
    await page.waitForTimeout(3000);
    const navLink = page.locator('a[href*="/fiabilite"]');
    await expect(navLink.first()).toBeVisible({ timeout: 10000 });
  });

  test("fiabilite page renders without errors on BMW", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw/3-series/e46/fiabilite");
    await expect(
      page.locator("text=Fiabilité").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator("text=Score de fiabilité").first()
    ).toBeVisible({ timeout: 5000 });
  });
});
