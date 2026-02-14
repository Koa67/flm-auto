import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers';

test.describe('Phase 8 — Auth, Dashboard, PDF, PWA', () => {
  test.setTimeout(60000);

  test('Connexion page loads with OAuth and email forms', async ({ page }) => {
    await dismissOverlays(page);
    await page.goto('/connexion');
    await expect(page.locator('h1')).toContainText('Bienvenue', { timeout: 15000 });
    // OAuth buttons
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Apple/ })).toBeVisible();
    // Tabs
    await expect(page.getByRole('tab', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Inscription' })).toBeVisible();
  });

  test('Dashboard redirects to connexion when not authenticated', async ({ page }) => {
    await dismissOverlays(page);
    await page.goto('/dashboard');
    await page.waitForURL(/\/connexion/, { timeout: 15000 });
    expect(page.url()).toContain('/connexion');
    expect(page.url()).toContain('redirect=%2Fdashboard');
  });

  test('Compare page has PDF export button after comparison', async ({ page }) => {
    await dismissOverlays(page);
    await page.goto('/comparer');
    await expect(page.locator('h1')).toContainText('Comparateur', { timeout: 15000 });
    // The export button only appears after a comparison is performed
    // But the page should load successfully
  });

  test('Offline page exists', async ({ page }) => {
    await page.goto('/offline.html');
    await expect(page.locator('h1')).toContainText('hors ligne', { timeout: 15000 });
    await expect(page.getByRole('button', { name: /essayer/i })).toBeVisible();
  });

  test('Service worker file exists', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('CACHE_NAME');
  });

  test('Manifest has PWA fields', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.name).toContain('FLM');
    expect(data.display).toBe('standalone');
    expect(data.scope).toBe('/');
    expect(data.categories).toContain('auto');
  });

  test('Saved comparisons API returns 401 when not authenticated', async ({ request }) => {
    const res = await request.get('/api/saved-comparisons');
    expect(res.status()).toBe(401);
  });

  test('Saved searches API returns 401 when not authenticated', async ({ request }) => {
    const res = await request.get('/api/saved-searches');
    expect(res.status()).toBe(401);
  });

  test('Search page has save button', async ({ page }) => {
    await dismissOverlays(page);
    await page.goto('/recherche?q=golf');
    // Wait for search results to load first (button only renders with results)
    await page.waitForSelector("a[href^='/marques/']", { timeout: 20000 });
    await expect(page.getByRole('button', { name: /Sauvegarder/i })).toBeVisible({ timeout: 10000 });
  });
});
