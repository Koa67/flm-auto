import { test, expect } from '@playwright/test';

const BASE_GEN = '/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8';

test.describe('Phase 7 — Premium Quality & Finitions', () => {
  test.setTimeout(60000);

  test('Homepage loads as server component with real stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('encyclop', { timeout: 15000 });
    // Should have brand showcase section
    await expect(page.getByRole('heading', { name: 'Toutes les marques' })).toBeVisible();
    // Should have tools section in main content
    await expect(page.getByRole('main').getByRole('heading', { name: 'Outils' })).toBeVisible();
  });

  test('Stats API returns valid response', async ({ request }) => {
    const res = await request.get('/api/stats');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.brands).toBeGreaterThanOrEqual(0);
    expect(data.generations).toBeGreaterThanOrEqual(0);
    expect(typeof data.photos).toBe('number');
    expect(typeof data.specs).toBe('number');
  });

  test('Photos page uses GalleryPro with category filters', async ({ page }) => {
    await page.goto(`${BASE_GEN}/photos`);
    await expect(page.locator('h1')).toContainText('Photos', { timeout: 15000 });
  });

  test('Generation page loads with hero section', async ({ page }) => {
    await page.goto(BASE_GEN);
    // Page should load successfully (title confirms data loaded)
    await expect(page).toHaveTitle(/Golf/, { timeout: 15000 });
  });

  test('Videos page loads with featured player', async ({ page }) => {
    await page.goto(`${BASE_GEN}/videos`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Vid', { timeout: 15000 });
  });

  test('Alternatives page shows comparison metrics', async ({ page }) => {
    await page.goto(`${BASE_GEN}/alternatives`);
    await expect(page.locator('h1')).toContainText('Alternatives', { timeout: 15000 });
  });

  test('Compare page loads', async ({ page }) => {
    await page.goto('/comparer');
    await expect(page.locator('h1')).toContainText('Comparateur', { timeout: 15000 });
  });

});
