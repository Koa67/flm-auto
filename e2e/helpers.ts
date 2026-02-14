import { Page } from "@playwright/test";

/**
 * Dismiss all overlays (onboarding tour, cookie banner)
 * Call this BEFORE page.goto() — addInitScript must run before navigation.
 */
export async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("flm-onboarding-done", "true");
    localStorage.setItem("flm-cookie-consent", "accepted");
  });
}

/**
 * Check if running on mobile viewport
 */
export function isMobile(page: Page): boolean {
  const size = page.viewportSize();
  return (size?.width ?? 1280) < 768;
}
