import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

test.describe("ALAIN Chat Widget", () => {
  async function openChat(page: import("@playwright/test").Page) {
    await dismissOverlays(page);
    await page.goto("/marques");
    const trigger = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(trigger).toBeAttached({ timeout: 15000 });
    // Wait briefly for Framer Motion animation to complete (scale: 0 → 1)
    await page.waitForTimeout(500);
    // Use JS click to bypass viewport/animation checks
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Ouvrir ALAIN"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
  }

  test("chat button is present on page", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques");
    const alainButton = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(alainButton).toBeAttached({ timeout: 15000 });
  });

  test("chat panel opens and shows welcome", async ({ page }) => {
    await openChat(page);
    await expect(
      page.locator("text=ALAIN").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("chat accepts text input", async ({ page }) => {
    await openChat(page);
    const input = page.locator("textarea");
    await expect(input.first()).toBeVisible({ timeout: 5000 });
    await input.first().fill("Bonjour ALAIN");
    await expect(input.first()).toHaveValue("Bonjour ALAIN");
  });
});
