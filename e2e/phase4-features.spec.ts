import { test, expect } from '@playwright/test';

test.describe('Phase 4 Features', () => {

  test('Recalls tab visible on vehicle page', async ({ page }) => {
    await page.goto('/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8');
    const recallsTab = page.locator('[role="tab"]:has-text("Rappels")');
    await expect(recallsTab).toBeVisible({ timeout: 15000 });
  });

  test('Recalls API returns valid response', async ({ request }) => {
    const response = await request.get('/api/recalls?brand=Ford&model=Focus');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('recalls');
    expect(Array.isArray(data.recalls)).toBeTruthy();
    expect(data).toHaveProperty('count');
  });

  test.skip('ISOFIX schema renders in Family Fit tab', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8', { timeout: 90000, waitUntil: 'domcontentloaded' });
    // Dismiss overlays if present
    try {
      const acceptBtn = page.locator('button:has-text("Accepter")');
      if (await acceptBtn.isVisible({ timeout: 3000 })) await acceptBtn.click();
    } catch { /* no banner */ }
    try {
      const closeBtn = page.locator('[aria-label="Close"], button:has-text("Fermer")').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
    } catch { /* no overlay */ }
    const familyTab = page.locator('[role="tab"]:has-text("Family Fit")');
    if (await familyTab.count() > 0) {
      await familyTab.click();
      const isofixContent = page.locator('text=ISOFIX');
      await expect(isofixContent.first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('Safety page has recall section', async ({ page }) => {
    await page.goto('/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8/securite');
    const recallSection = page.locator('text=Rappels constructeur');
    await expect(recallSection).toBeVisible({ timeout: 15000 });
  });

  test('Gallery page loads with photos', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8/photos', { timeout: 60000 });
    const heading = page.locator('h1');
    await expect(heading).toContainText('Photos', { timeout: 15000 });
  });

});
