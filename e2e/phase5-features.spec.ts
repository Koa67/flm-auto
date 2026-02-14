import { test, expect } from '@playwright/test';

test.describe('Phase 5 Features', () => {

  test('Configurateur Inversé page loads with wizard', async ({ page }) => {
    await page.goto('/configurateur');
    await expect(page.locator('h1')).toContainText('Configurateur', { timeout: 15000 });
  });

  test('Configurateur search API returns results', async ({ request }) => {
    const response = await request.post('/api/configurateur/search', {
      data: {
        fuel_types: ['petrol', 'essence'],
        priorities: ['prix', 'espace'],
        limit: 5
      }
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('results');
    expect(Array.isArray(data.results)).toBeTruthy();
    expect(data).toHaveProperty('total');
  });

  test('Favoris page loads', async ({ page }) => {
    await page.goto('/favoris');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  });

  test('Wishlist API returns data for new user', async ({ request }) => {
    const response = await request.get('/api/wishlist');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('Schema.org JSON-LD on vehicle page', async ({ page }) => {
    await page.goto('/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8');
    // Wait for page to fully render
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);
    const content = await jsonLd.first().textContent();
    expect(content).toContain('"@type"');
    expect(content).toContain('Car');
  });

  test('Sitemap is accessible and has URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('<url>');
    expect(text).toContain('/marques');
  });

  test('Configurateur page is reachable', async ({ page }) => {
    // The configurateur is accessible from homepage tools, not the main nav
    await page.goto('/configurateur');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  });

});
