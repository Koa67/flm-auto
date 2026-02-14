import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

test.describe("Comparateur", () => {
  test("compare page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/comparer");
    await expect(page.locator("h1")).toContainText("Comparateur");
    await expect(
      page.getByPlaceholder(/Ajouter/)
    ).toBeVisible();
  });

  test("can search for vehicles", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/comparer");
    const input = page.getByPlaceholder(/Ajouter/);
    await input.click();
    await input.pressSequentially("bmw m3", { delay: 50 });
    // Wait for debounce (300ms) + API response
    await page.waitForSelector("button:has-text('BMW')", { timeout: 20000 });
    const results = page.locator("button").filter({ hasText: "BMW" });
    expect(await results.count()).toBeGreaterThan(0);
  });

  test("compare button is disabled with < 2 vehicles", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/comparer");
    const button = page.getByRole("button", { name: /Comparer/ });
    await expect(button).toBeDisabled();
  });

  test("floating compare bar is hidden initially", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    // The floating compare bar only shows when vehicles are in the compare store
    await expect(
      page.locator(".fixed.bottom-6:has-text('Comparer')")
    ).not.toBeVisible();
  });
});
