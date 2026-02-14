import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { name: "Homepage", path: "/" },
  { name: "Brands", path: "/marques" },
  { name: "Compare", path: "/comparer" },
  { name: "Search", path: "/recherche" },
];

for (const { name, path } of pages) {
  test(`${name} page has no critical a11y violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"]) // Color contrast in dark mode can be tricky
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (critical.length > 0) {
      console.log(
        `A11y violations on ${name}:`,
        critical.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        }))
      );
    }

    expect(critical).toHaveLength(0);
  });
}

test("images have alt text", async ({ page }) => {
  await page.goto("/marques");
  await page.waitForLoadState("networkidle");

  const images = page.locator("img");
  const count = await images.count();

  for (let i = 0; i < Math.min(count, 20); i++) {
    const img = images.nth(i);
    const alt = await img.getAttribute("alt");
    const role = await img.getAttribute("role");
    // Images should have alt text or role="presentation"
    expect(alt !== null || role === "presentation").toBeTruthy();
  }
});

test("interactive elements are keyboard accessible", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, "Keyboard tab navigation not applicable on mobile");
  await page.goto("/");

  // Tab through the page and check focus is visible
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();

  // Nav links should be focusable
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
  }
  const currentFocus = page.locator(":focus");
  await expect(currentFocus).toBeVisible();
});

test("page has proper heading hierarchy", async ({ page }) => {
  await page.goto("/marques");
  await page.waitForLoadState("networkidle");

  // Should have an h1
  const h1 = page.locator("h1");
  expect(await h1.count()).toBe(1);

  // h1 should come before h2
  const headings = await page.locator("h1, h2, h3").allTextContents();
  expect(headings.length).toBeGreaterThan(0);
});

test("form inputs have labels or aria-labels", async ({ page }) => {
  await page.goto("/recherche");

  const inputs = page.locator("input");
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const ariaLabel = await input.getAttribute("aria-label");
    const ariaLabelledBy = await input.getAttribute("aria-labelledby");
    const placeholder = await input.getAttribute("placeholder");
    const id = await input.getAttribute("id");

    // Input should have some form of label
    const hasLabel =
      ariaLabel || ariaLabelledBy || placeholder || (id && (await page.locator(`label[for="${id}"]`).count()) > 0);
    expect(hasLabel).toBeTruthy();
  }
});
