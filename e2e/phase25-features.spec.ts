import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";
import * as fs from "fs";
import * as path from "path";

const VW_GOLF = "/marques/volkswagen/volkswagen-golf/volkswagen-golf-golf-8";

// ── ALAIN V5 ────────────────────────────────────────────────────────
test.describe("Phase 25 — ALAIN v5 Context", () => {
  test("ALAIN chat widget opens on button click", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const alainButton = page.locator('button[aria-label="Ouvrir ALAIN"]');
    await expect(alainButton).toBeVisible({ timeout: 15000 });
    await alainButton.click();
    // Should show the chat panel with ALAIN title
    await expect(page.locator("text=ALAIN").first()).toBeVisible({ timeout: 5000 });
  });

  test("context-tracker module file exists", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/alain/context-tracker.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("buildStructuredContext");
    expect(content).toContain("buildContextPrompt");
  });

  test("follow-up detector module file exists", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/alain/follow-up-detector.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("detectFollowUp");
  });

  test("dynamic suggestions module file exists", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/alain/dynamic-suggestions.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("generateDynamicSuggestions");
  });

  test("ALAIN prompts include expanded scope v5", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/lib/alain/prompts.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Scope");
    expect(content).toContain("Financement");
  });
});

// ── SEO STRUCTURED DATA ─────────────────────────────────────────────
test.describe("Phase 25 — SEO Structured Data", () => {
  test("homepage has WebSite schema with SearchAction", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/", { waitUntil: "networkidle" });
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const combined = scripts.join(" ");
    expect(combined).toContain("WebSite");
    expect(combined).toContain("SearchAction");
  });

  test("brand page has BreadcrumbList schema", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/bmw", { waitUntil: "domcontentloaded" });
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasBreadcrumb = scripts.some((s) => s.includes("BreadcrumbList"));
    expect(hasBreadcrumb).toBe(true);
  });

  test("generation page has BreadcrumbList schema", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasBreadcrumb = scripts.some((s) => s.includes("BreadcrumbList"));
    expect(hasBreadcrumb).toBe(true);
  });

  test("meilleur page has FAQPage + ItemList schema", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/meilleur/meilleur-suv-familial-2025", { waitUntil: "domcontentloaded" });
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const combined = scripts.join(" ");
    expect(combined).toContain("FAQPage");
    expect(combined).toContain("ItemList");
  });
});

// ── SEO CANONICAL + META ────────────────────────────────────────────
test.describe("Phase 25 — SEO Canonical & Meta", () => {
  test("brand page has canonical link", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/marques/audi", { waitUntil: "domcontentloaded" });
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain("/marques/audi");
  });

  test("meilleur page has OG image", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/meilleur/voiture-5-etoiles-euroncap-2025", { waitUntil: "domcontentloaded" });
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();
    expect(ogImage).toContain("/api/og");
  });
});

// ── SEO INTERNAL LINKING ────────────────────────────────────────────
test.describe("Phase 25 — SEO Internal Linking", () => {
  test("generation page has related links section", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto(VW_GOLF, { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Voir aussi").first()).toBeVisible({ timeout: 30000 });
  });

  test("meilleur page has related ranking links", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/meilleur/meilleur-suv-familial-2025", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Autres classements").first()).toBeVisible({ timeout: 15000 });
  });

  test("meilleur page has editorial intro paragraph", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/meilleur/meilleur-suv-familial-2025", { waitUntil: "domcontentloaded" });
    const year = new Date().getFullYear().toString();
    await expect(page.locator(`text=${year}`).first()).toBeVisible({ timeout: 15000 });
  });
});

// ── SEO ROBOTS + NOINDEX ────────────────────────────────────────────
test.describe("Phase 25 — SEO Robots & Noindex", () => {
  test("robots.txt blocks GPTBot", async ({ page }) => {
    const response = await page.goto("/robots.txt", { waitUntil: "domcontentloaded" });
    const text = await response?.text();
    expect(text).toContain("GPTBot");
    expect(text).toContain("Disallow: /");
  });

  test("robots.txt blocks CCBot", async ({ page }) => {
    const response = await page.goto("/robots.txt", { waitUntil: "domcontentloaded" });
    const text = await response?.text();
    expect(text).toContain("CCBot");
  });

  test("robots.txt disallows /dashboard/", async ({ page }) => {
    const response = await page.goto("/robots.txt", { waitUntil: "domcontentloaded" });
    const text = await response?.text();
    expect(text).toContain("/dashboard/");
  });

  test("sitemap.ts source includes fiabilite sub-page", async ({}) => {
    const filePath = path.resolve(__dirname, "../src/app/sitemap.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("fiabilite");
  });
});
