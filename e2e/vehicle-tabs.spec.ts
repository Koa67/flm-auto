import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

test.describe("Vehicle Page Tabs", () => {
  // Use a known brand page as entry point
  test("brand page loads with models", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    // Should show model cards or links
    const content = await page.textContent("body");
    expect(content).toMatch(/Serie|X[1-7]|i[34x]|M[2-8]/i);
  });

  test("search page returns results", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche?q=Peugeot");
    await expect(
      page.locator("text=Peugeot").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("compare page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/comparer");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    const content = await page.textContent("body");
    expect(content).toMatch(/compar/i);
  });

  test("family fit page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/family-fit");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
  });

  test("profile wizard page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/profil");
    await expect(page.locator("h1")).toContainText("voiture", {
      timeout: 10000,
    });
    // Should show the first step (budget)
    await expect(
      page.getByRole("heading", { name: /budget/i })
    ).toBeVisible();
  });

  test("profile wizard navigation works", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/profil");
    await expect(page.locator("text=Budget").first()).toBeVisible({
      timeout: 10000,
    });

    // Click "Suivant" to go to step 2
    const nextButton = page.locator("button").filter({ hasText: "Suivant" });
    await nextButton.click();

    // Should now show Usage step — heading is "Votre usage principal ?"
    // AnimatePresence transition takes ~200ms, wait longer on mobile
    await expect(
      page.getByRole("heading", { name: /usage/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
