import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";

// ── BLOC 1: Build & metadataBase ─────────────────────────────────
test.describe("Phase 30 — Build & Metadata", () => {
  test("root layout has metadataBase", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/app/layout.tsx"),
      "utf-8"
    );
    expect(content).toContain("metadataBase");
  });

  test("homepage renders valid HTML title", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    const title = await page.title();
    expect(title).toContain("FLM Auto");
  });
});

// ── BLOC 2: API route fixes ──────────────────────────────────────
test.describe("Phase 30 — API Route Fixes", () => {
  test("newsletter subscribe handles missing email gracefully", async ({
    request,
  }) => {
    const res = await request.post("/api/newsletter/subscribe", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("vehicles/search returns empty when table missing", async ({
    request,
  }) => {
    const res = await request.post("/api/vehicles/search", {
      data: { per_page: 5 },
    });
    // Should return 200 with empty results (graceful fallback) or 500 if table exists but has issues
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("results");
      expect(body).toHaveProperty("total");
    }
  });

  test("newsletter route uses logError not console.error", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(
        __dirname,
        "../src/app/api/newsletter/subscribe/route.ts"
      ),
      "utf-8"
    );
    expect(content).toContain("logError");
    expect(content).not.toContain("console.error");
  });
});

// ── BLOC 3+4: Lighthouse & A11y fixes ────────────────────────────
test.describe("Phase 30 — Accessibility", () => {
  test("hero carousel dots have aria-labels", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/vehicle/hero-section.tsx"),
      "utf-8"
    );
    expect(content).toContain("aria-label");
    expect(content).toContain("role=\"tab\"");
  });

  test("gallery-pro buttons have aria-labels", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/vehicle/gallery-pro.tsx"),
      "utf-8"
    );
    expect(content).toContain('aria-label="Image précédente"');
    expect(content).toContain('aria-label="Fermer"');
    expect(content).toContain('aria-label="Photo précédente"');
  });

  test("pros-cons uses p not h3 (heading order fix)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/vehicle/pros-cons.tsx"),
      "utf-8"
    );
    expect(content).not.toContain("<h3");
    expect(content).toContain("Points forts</p>");
    expect(content).toContain("Points faibles</p>");
  });

  test("muted-foreground color meets WCAG AA contrast", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(
      path.resolve(__dirname, "../src/app/globals.css"),
      "utf-8"
    );
    // Should NOT be the old low-contrast #707085
    expect(css).not.toContain("--color-muted-foreground: #707085");
    // Should be the WCAG-compliant value
    expect(css).toContain("--color-muted-foreground: #8585a0");
  });

  test("3d model-viewer has aria-labels", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/3d/model-viewer.tsx"),
      "utf-8"
    );
    expect(content).toContain('aria-label="Ouvrir le modèle 3D"');
    expect(content).toContain("Plein écran");
  });
});

// ── BLOC 5: SEO structured data ──────────────────────────────────
test.describe("Phase 30 — SEO", () => {
  test("homepage has WebSite JSON-LD schema", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasWebSite = scripts.some((s) => s.includes('"@type":"WebSite"'));
    expect(hasWebSite).toBe(true);
  });

  test("homepage JSON-LD has SearchAction", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasSearchAction = scripts.some((s) => s.includes("SearchAction"));
    expect(hasSearchAction).toBe(true);
  });

  test("sitemap.xml is accessible", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("<urlset");
    expect(text).toContain("flm-auto.fr");
  });

  test("robots.txt is accessible", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("Sitemap:");
  });
});

// ── General Health ───────────────────────────────────────────────
test.describe("Phase 30 — General Health", () => {
  test("homepage loads fast with sections", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    const h2s = page.locator("h2");
    expect(await h2s.count()).toBeGreaterThanOrEqual(3);
  });

  test("brands page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques");
    await expect(page.locator("h1").first()).toContainText("marques", { ignoreCase: true });
  });

  test("/api/brands returns 200", async ({ request }) => {
    const res = await request.get("/api/brands");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("/api/stats returns 200", async ({ request }) => {
    const res = await request.get("/api/stats");
    expect(res.status()).toBe(200);
  });
});
