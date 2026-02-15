import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";
import * as fs from "fs";
import * as path from "path";

// ── SUPABASE CONSOLIDATION ──────────────────────────────────────────
test.describe("Phase 26 — Supabase Migration", () => {
  test("old supabase-server.ts is deleted", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/supabase-server.ts");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("old supabase.ts is deleted", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/supabase.ts");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("new server.ts has createStaticClient", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/supabase/server.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("createStaticClient");
    expect(content).toContain("createAuthServerClient");
  });

  test("admin.ts has createServiceClient", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/supabase/admin.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("createServiceClient");
    expect(content).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("homepage loads after supabase migration", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
  });

  test("brand page loads after supabase migration", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
  });

  test("generation page loads after supabase migration", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
  });
});

// ── DEAD CODE REMOVAL ──────────────────────────────────────────────
test.describe("Phase 26 — Dead Code Removed", () => {
  test("animated-counter.tsx is deleted", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/animated-counter.tsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("stagger-list.tsx is deleted", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/components/stagger-list.tsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("lib/index.ts barrel is deleted", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/index.ts");
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

// ── CSS CLEANUP ────────────────────────────────────────────────────
test.describe("Phase 26 — CSS & Template", () => {
  test("globals.css has no dead .light block", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/globals.css");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).not.toContain(":root:not(.dark)");
  });

  test("globals.css has proper --font-mono fallback", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/globals.css");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("ui-monospace");
    expect(content).not.toMatch(/--font-mono:\s*var\(--font-mono\)/);
  });

  test("stagger-reveal CSS still present", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/globals.css");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("stagger-reveal");
    expect(content).toContain("stagger-in");
  });

  test("homepage stagger-reveal visible", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const staggerEl = page.locator(".stagger-reveal").first();
    await expect(staggerEl).toBeVisible({ timeout: 15000 });
  });
});

// ── STRUCTURED LOGGING ─────────────────────────────────────────────
test.describe("Phase 26 — Structured Logging", () => {
  test("no console.error in src/app/ (source check)", async ({}) => {
    const srcDir = path.resolve(__dirname, "../src/app");
    const files = walkDir(srcDir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    const violations: string[] = [];
    for (const file of files) {
      // Skip logger.ts itself
      if (file.includes("logger.ts")) continue;
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("console.error")) {
        violations.push(file.replace(srcDir, "src/app"));
      }
    }
    expect(violations).toEqual([]);
  });

  test("/api/brands returns 200", async ({ page }) => {
    const response = await page.goto("/api/brands", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
  });

  test("/api/stats returns 200", async ({ page }) => {
    const response = await page.goto("/api/stats", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
  });
});

// ── ALAIN SUGGESTIONS ──────────────────────────────────────────────
test.describe("Phase 26 — ALAIN Suggestions Simplified", () => {
  test("suggestions.ts exports getDefaultSuggestions", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/alain/suggestions.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("getDefaultSuggestions");
    expect(content).not.toContain("generateSuggestions");
    expect(content).not.toContain("ConversationContext");
  });

  test("ALAIN widget shows default suggestions on open", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const alainButton = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(alainButton).toBeVisible({ timeout: 15000 });
    await alainButton.click();
    // Should show at least one default suggestion text
    await expect(page.locator("text=Meilleur SUV familial").first()).toBeVisible({ timeout: 5000 });
  });
});

/** Recursively walk directory and return all file paths */
function walkDir(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
