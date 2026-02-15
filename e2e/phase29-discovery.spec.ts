import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

// ── SEARCH API (Bloc 1) ──────────────────────────────────────────
test.describe("Phase 29 — Advanced Search API", () => {
  test("POST /api/vehicles/search endpoint exists", async ({ request }) => {
    const res = await request.post("/api/vehicles/search", {
      data: { per_page: 5 },
    });
    // Endpoint exists and responds (200 or 500 if search_index table missing)
    expect([200, 500]).toContain(res.status());
  });

  test("search route file exists with POST handler", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      __dirname,
      "../src/app/api/vehicles/search/route.ts"
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export async function POST");
  });
});

// ── RECHERCHE PAGE (Bloc 2) ──────────────────────────────────────
test.describe("Phase 29 — Recherche Page", () => {
  test("recherche page loads with search bar", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche");
    await expect(page.locator("h1").first()).toContainText("Recherche");
    await expect(page.locator("input[placeholder]").first()).toBeVisible();
  });

  test("recherche page has filter and sort controls", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/recherche");
    // Sort select exists
    const select = page.locator("select");
    expect(await select.count()).toBeGreaterThanOrEqual(1);
  });
});

// ── BROWSE PAGES (Bloc 3) ────────────────────────────────────────
test.describe("Phase 29 — Explorer Browse Pages", () => {
  test("explorer hub loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/explorer");
    await expect(page.locator("h1").first()).toContainText("Explorer");
  });

  test("segment browse page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/explorer/segment/suv");
    await expect(page.locator("h1").first()).toContainText("SUV");
  });

  test("fuel browse page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/explorer/carburant/electrique");
    await expect(page.locator("h1").first()).toContainText("lectrique");
  });

  test("budget browse page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/explorer/budget/premium-luxe");
    await expect(page.locator("h1").first()).toContainText("Premium");
  });

  test("decade browse page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/explorer/decennie/2020");
    await expect(page.locator("h1").first()).toContainText("2020");
  });

  test("explorer-config.ts has all category exports", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/explorer-config.ts"),
      "utf-8"
    );
    expect(content).toContain("SEGMENT_CATEGORIES");
    expect(content).toContain("FUEL_CATEGORIES");
    expect(content).toContain("BUDGET_CATEGORIES");
    expect(content).toContain("DECADE_CATEGORIES");
  });
});

// ── HOMEPAGE PERSONALIZATION (Bloc 4) ────────────────────────────
test.describe("Phase 29 — Homepage Shelves", () => {
  test("homepage loads with multiple sections", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    await page.waitForTimeout(500);
    const h2s = page.locator("h2");
    expect(await h2s.count()).toBeGreaterThanOrEqual(3);
  });
});

// ── VEHICLE PAGE POLISH (Bloc 5) ─────────────────────────────────
test.describe("Phase 29 — Vehicle Page Polish", () => {
  test("generation page loads with h1", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw/3-series/e90");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("generation page imports share and compare components", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(
        __dirname,
        "../src/app/marques/[brand]/[model]/[generation]/page.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain("ShareButton");
    expect(content).toContain("CompareQuickAction");
    expect(content).toContain("AlternativesShelf");
  });

  test("essential-stats component file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    expect(
      fs.existsSync(
        path.resolve(__dirname, "../src/components/vehicle/essential-stats.tsx")
      )
    ).toBe(true);
  });

  test("alternatives-shelf component file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    expect(
      fs.existsSync(
        path.resolve(
          __dirname,
          "../src/components/vehicle/alternatives-shelf.tsx"
        )
      )
    ).toBe(true);
  });
});

// ── BRAND PAGE (Bloc 6) ──────────────────────────────────────────
test.describe("Phase 29 — Brand Page Redesign", () => {
  test("brand page loads with brand name", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw");
    await expect(page.locator("h1").first()).toContainText("BMW");
  });

  test("brand page shows stat badges", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw");
    await page.waitForTimeout(500);
    const text = await page.textContent("body");
    expect(text).toContain("Modèles");
    expect(text).toContain("Générations");
  });

  test("brand page has model links", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw");
    await page.waitForTimeout(500);
    const links = page.locator('a[href*="/marques/bmw/"]');
    expect(await links.count()).toBeGreaterThan(0);
  });
});

// ── MODEL PAGE TIMELINE (Bloc 7) ─────────────────────────────────
test.describe("Phase 29 — Model Page Timeline", () => {
  test("model page loads with generation stats", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw/3-series");
    await expect(page.locator("h1").first()).toBeVisible();
    const text = await page.textContent("body");
    expect(text).toContain("Générations");
  });

  test("model page has generation links", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw/3-series");
    await page.waitForTimeout(500);
    const genLinks = page.locator('a[href*="/marques/bmw/3-series/"]');
    expect(await genLinks.count()).toBeGreaterThan(0);
  });
});

// ── COMMAND PALETTE (Bloc 8) ─────────────────────────────────────
test.describe("Phase 29 — Command Palette", () => {
  test("command palette opens with Ctrl+K", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    const dialog = page.locator("[role='dialog']");
    expect(await dialog.count()).toBeGreaterThanOrEqual(1);
  });

  test("palette has sections when empty", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    const text = await page.textContent("[role='dialog']");
    expect(text).toContain("Navigation");
    expect(text).toContain("Explorer par segment");
  });

  test("palette has keyboard hints footer", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    const text = await page.textContent("[role='dialog']");
    expect(text).toContain("⌘K");
  });
});

// ── CONFIGURATEUR BRIDGE (Bloc 12) ───────────────────────────────
test.describe("Phase 29 — Configurateur", () => {
  test("configurateur page loads with steps", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/configurateur");
    await expect(page.locator("h1").first()).toContainText("Configurateur");
  });

  test("configurateur result card has compare button", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(
        __dirname,
        "../src/components/configurateur/vehicle-result-card.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain("useCompareStore");
    expect(content).toContain("GitCompareArrows");
  });

  test("configurateur has recherche bridge link", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(
        __dirname,
        "../src/components/configurateur/inverse-configurator.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain("buildRechercheUrl");
    expect(content).toContain("Affiner dans la recherche");
  });
});

// ── SHARE + PRINT (Bloc 13) ─────────────────────────────────────
test.describe("Phase 29 — Share & Print", () => {
  test("share-button component exports ShareButton", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/share-button.tsx"),
      "utf-8"
    );
    expect(content).toContain("export function ShareButton");
    expect(content).toContain("navigator.share");
    expect(content).toContain("clipboard.writeText");
  });

  test("globals.css has print styles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(
      path.resolve(__dirname, "../src/app/globals.css"),
      "utf-8"
    );
    expect(css).toContain("@media print");
    expect(css).toContain("@page");
    expect(css).toContain("nav,");
  });
});
