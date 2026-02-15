import { test, expect } from "@playwright/test";
import { dismissOverlays } from "./helpers";
import * as fs from "fs";
import * as path from "path";

// ── PWA ICONS (Bloc 1) ─────────────────────────────────────────────
test.describe("Phase 28 — PWA Icons", () => {
  test("icon.tsx generates a PNG", async ({ page }) => {
    const resp = await page.request.get("/icon?size=512");
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("image/png");
  });

  test("apple-icon.tsx generates a PNG", async ({ page }) => {
    const resp = await page.request.get("/apple-icon");
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("image/png");
  });

  test("manifest.json references icon routes", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../public/manifest.json"), "utf-8")
    );
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    const srcs = manifest.icons.map((i: any) => i.src);
    expect(srcs.some((s: string) => s.includes("/icon"))).toBe(true);
  });
});

// ── ALERTES PAGE (Bloc 2) ───────────────────────────────────────────
test.describe("Phase 28 — Alertes Page", () => {
  test("unauthenticated user redirected to /connexion", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/alertes");
    await page.waitForURL(/connexion/);
    expect(page.url()).toContain("/connexion");
  });

  test("alertes page file exists with auth check", () => {
    const filePath = path.resolve(__dirname, "../src/app/alertes/page.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("createAuthServerClient");
    expect(content).toContain('redirect("/connexion');
  });
});

// ── PROFILE WIZARD (Bloc 4) ────────────────────────────────────────
test.describe("Phase 28 — Profile Wizard", () => {
  test("profil page loads without redirect loop", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/profil");
    expect(page.url()).toContain("/profil");
    // Should show wizard (budget step) since no profile completed
    await expect(page.getByRole("heading", { name: "Quel est votre budget ?" })).toBeVisible({ timeout: 5000 });
  });

  test("recommendations module exports getRecommendations", () => {
    const filePath = path.resolve(__dirname, "../src/lib/recommendations.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export function getRecommendations");
    expect(content).toContain("Recommendation");
  });
});

// ── OG IMAGES (Bloc 5) ─────────────────────────────────────────────
test.describe("Phase 28 — OG Images", () => {
  test("root layout has default og:image", () => {
    const filePath = path.resolve(__dirname, "../src/app/layout.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("/api/og?title=");
    expect(content).toContain("openGraph");
  });

  test("meilleur page has og:image metadata", () => {
    const filePath = path.resolve(__dirname, "../src/app/meilleur/page.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("openGraph");
    expect(content).toContain("/api/og");
  });
});

// ── ANTHROPIC STREAMING (Bloc 6) ───────────────────────────────────
test.describe("Phase 28 — Anthropic Streaming", () => {
  test("handleAnthropicStream function exists in chat route", () => {
    const filePath = path.resolve(__dirname, "../src/app/api/alain/chat/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("function handleAnthropicStream");
    expect(content).toContain("client.messages.stream");
    expect(content).toContain('type: "token"');
    expect(content).toContain('provider: "anthropic"');
  });

  test("fallback section uses streaming when wantStream is true", () => {
    const filePath = path.resolve(__dirname, "../src/app/api/alain/chat/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // The fallback section should check wantStream before calling handleAnthropicStream
    expect(content).toContain("if (wantStream)");
    expect(content).toContain("handleAnthropicStream(systemPrompt, messages, ctx)");
    expect(content).toContain("text/event-stream");
  });
});

// ── NEWSLETTER RESEND (Bloc 7) ─────────────────────────────────────
test.describe("Phase 28 — Newsletter Resend", () => {
  test("email.ts exports sendWelcomeEmail", () => {
    const filePath = path.resolve(__dirname, "../src/lib/email.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export async function sendWelcomeEmail");
    expect(content).toContain("RESEND_API_KEY");
    expect(content).toContain("Bienvenue sur FLM Auto");
  });

  test("newsletter route calls sendWelcomeEmail", () => {
    const filePath = path.resolve(__dirname, "../src/app/api/newsletter/subscribe/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("sendWelcomeEmail");
    expect(content).toContain('@/lib/email');
  });
});

// ── SW CACHE-BUSTING (Bloc 8) ──────────────────────────────────────
test.describe("Phase 28 — SW Cache-busting", () => {
  test("SW uses v2 cache name", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../public/sw.js"), "utf-8"
    );
    expect(content).toContain("flm-auto-v2");
  });

  test("SW register includes build ID", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/sw-register.tsx"), "utf-8"
    );
    expect(content).toContain("BUILD_ID");
    expect(content).toContain("reg.update()");
  });
});

// ── GSC + DEPLOY (Bloc 9) ──────────────────────────────────────────
test.describe("Phase 28 — GSC + Deploy", () => {
  test("layout includes conditional GSC meta tag", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/app/layout.tsx"), "utf-8"
    );
    expect(content).toContain("google-site-verification");
    expect(content).toContain("NEXT_PUBLIC_GSC_VERIFICATION");
  });

  test("DEPLOY.md exists with checklist", () => {
    const filePath = path.resolve(__dirname, "../DEPLOY.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(content).toContain("ANTHROPIC_API_KEY");
    expect(content).toContain("Post-Deploy Verification");
  });
});

// ── PRIVACY PAGE (Bloc 10) ─────────────────────────────────────────
test.describe("Phase 28 — Privacy Page", () => {
  test("privacy page mentions auth, alerts, and profile data", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/app/confidentialite/page.tsx"), "utf-8"
    );
    expect(content).toContain("Supabase Auth");
    expect(content).toContain("Alertes prix");
    expect(content).toContain("Profil");
  });

  test("privacy page loads", async ({ page }) => {
    await dismissOverlays(page);
    await page.goto("/confidentialite");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("confidentialit");
  });
});
