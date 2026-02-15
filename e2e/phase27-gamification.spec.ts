import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";
import * as fs from "fs";
import * as path from "path";

const VW_GOLF = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";

// ── GAMIFICATION STORE ────────────────────────────────────────────────
test.describe("Phase 27 — Gamification Store", () => {
  test("gamification store exports expected items", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/gamification-store.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    // Core exports
    expect(content).toContain("BADGES");
    expect(content).toContain("RARITY_CONFIG");
    expect(content).toContain("LEVELS");
    expect(content).toContain("getLevelForXP");
    expect(content).toContain("getXPProgress");
    // Rarity types
    expect(content).toContain("common");
    expect(content).toContain("rare");
    expect(content).toContain("epic");
    expect(content).toContain("legendary");
    // Streak fields
    expect(content).toContain("currentStreak");
    expect(content).toContain("longestStreak");
    expect(content).toContain("recordVisit");
    // XP + history
    expect(content).toContain("badgeUnlockHistory");
  });

  test("gamification store has 28+ badges", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/gamification-store.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Count badge definitions by their { id: " pattern
    const badgeIds = content.match(/\{\s*id:\s*"/g);
    expect(badgeIds).not.toBeNull();
    expect(badgeIds!.length).toBeGreaterThanOrEqual(28);
  });

  test("badges span all 4 rarity levels", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/gamification-store.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    for (const rarity of ["common", "rare", "epic", "legendary"]) {
      expect(content).toContain(`rarity: "${rarity}"`);
    }
  });
});

// ── BADGE PAGE ────────────────────────────────────────────────────────
test.describe("Phase 27 — Badge Page", () => {
  test("badge page loads with level and XP bar", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    // Should show "Niveau" label
    await expect(page.locator("text=Niveau").first()).toBeVisible({ timeout: 15000 });
    // Should show XP progress
    await expect(page.locator("text=XP total").first()).toBeVisible({ timeout: 5000 });
  });

  test("badge page shows rarity breakdown", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    // Rarity labels
    await expect(page.locator("text=Commun").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Rare").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Épique").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Légendaire").first()).toBeVisible({ timeout: 5000 });
  });

  test("badge page shows category sections", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/coffre/badges", { waitUntil: "domcontentloaded" });
    // Category headers
    await expect(page.locator("text=Exploration").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Comparaison").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Expert").first()).toBeVisible({ timeout: 5000 });
  });

  test("badge-grid component has streak UI", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/gamification/badge-grid.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    // Streak fields from store
    expect(content).toContain("currentStreak");
    expect(content).toContain("longestStreak");
    // Streak UI labels
    expect(content).toContain("rie"); // Série
    expect(content).toContain("Record");
    // Flame icon for streak
    expect(content).toContain("Flame");
  });

  test("badge count is dynamic (not hardcoded 16)", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/coffre/badges/page.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).not.toContain("16 badges");
    expect(content).toContain("BADGES.length");
  });
});

// ── NAV BADGE COUNTER ─────────────────────────────────────────────────
test.describe("Phase 27 — Nav Integration", () => {
  test("nav has trophy link to badges", async ({ page, isMobile }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    if (isMobile) {
      // On mobile, trophy link is inside the Sheet drawer
      const menuBtn = page.locator('button[aria-label="Menu de navigation"]');
      await expect(menuBtn).toBeVisible({ timeout: 15000 });
      await menuBtn.click();
      // Inside the Sheet, look for the "Badges" text link
      const badgesLink = page.getByRole("link", { name: "Badges" });
      await expect(badgesLink).toBeVisible({ timeout: 5000 });
    } else {
      const trophyLink = page.locator('a[aria-label="Mes badges"]');
      await expect(trophyLink).toBeVisible({ timeout: 15000 });
      expect(await trophyLink.getAttribute("href")).toBe("/coffre/badges");
    }
  });

  test("nav has favorites link", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const favLink = page.locator('a[aria-label="Mes favoris"]');
    await expect(favLink).toBeVisible({ timeout: 15000 });
    expect(await favLink.getAttribute("href")).toBe("/favoris");
  });
});

// ── STAT TRACKERS ─────────────────────────────────────────────────────
test.describe("Phase 27 — Stat Trackers", () => {
  test("ViewTracker component exists", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/view-tracker.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("incrementStat");
    expect(content).toContain("use client");
  });

  test("NightOwlTracker component exists", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/night-owl-tracker.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("nightVisits");
  });

  test("StreakTracker component exists", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/streak-tracker.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("recordVisit");
  });

  test("layout includes NightOwlTracker and StreakTracker", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/layout.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("NightOwlTracker");
    expect(content).toContain("StreakTracker");
  });

  test("dimensions page has ViewTracker", async ({}) => {
    const filePath = path.resolve(
      __dirname,
      "../src/app/marques/[brand]/[model]/[generation]/dimensions/page.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("ViewTracker");
  });

  test("alternatives page has ViewTracker", async ({}) => {
    const filePath = path.resolve(
      __dirname,
      "../src/app/marques/[brand]/[model]/[generation]/alternatives/page.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("ViewTracker");
  });
});

// ── RED TEAM: SECURITY FIXES ──────────────────────────────────────────
test.describe("Phase 27 — Red Team Security", () => {
  test("CORS returns empty origin for unknown requests", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/middleware.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Should not return a default origin for unknown requests
    expect(content).not.toMatch(/return\s+ALLOWED_ORIGINS\[0\]/);
    // Should return empty string for unknown origins
    expect(content).toContain('? origin : ""');
  });

  test("ALAIN vehicleContext is sanitized against prompt injection", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/api/alain/chat/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Should strip newlines and markdown headings
    expect(content).toContain("replace(/[\\n\\r#]/g");
    // Should have a length limit
    expect(content).toContain("slice(0, 200)");
  });

  test("cargo API validates UUID", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/api/cargo/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("isValidUUID");
  });

  test("family-fit search API has Zod validation", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/api/family-fit/search/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("safeParse");
  });

  test("recommend API has Zod validation", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/api/recommend/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("safeParse");
  });

  test("desktop search button has aria-label", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/nav.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    // The desktop search button (data-tour="search") should have aria-label
    expect(content).toContain('aria-label="Ouvrir la recherche"');
  });

  test("dashboard settings has noindex metadata", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/dashboard/settings/layout.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("index: false");
  });
});

// ── BADGE TOAST ───────────────────────────────────────────────────────
test.describe("Phase 27 — Badge Toast", () => {
  test("badge toast component uses rarity colors", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/badge-toast.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("RARITY_CONFIG");
    expect(content).toContain("rarity.color");
  });
});

// ── API SMOKE TESTS ───────────────────────────────────────────────────
test.describe("Phase 27 — API Smoke", () => {
  test("GET /api/brands returns 200", async ({ request }) => {
    const res = await request.get("/api/brands");
    expect(res.status()).toBe(200);
  });

  test("GET /api/stats returns 200", async ({ request }) => {
    const res = await request.get("/api/stats");
    expect(res.status()).toBe(200);
  });

  test("GET /api/health returns 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });
});
