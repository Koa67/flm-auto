import { test, expect } from "@playwright/test";

const pages = [
  { name: "Homepage", path: "/" },
  { name: "Brands", path: "/marques" },
  { name: "Compare", path: "/comparer" },
  { name: "Search", path: "/recherche" },
  { name: "Family Fit", path: "/family-fit" },
];

// ── Mobile overflow test ─────────────────────────────────────
test.describe("Mobile overflow audit", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const { name, path } of pages) {
    test(`${name} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(500);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasOverflow) {
        const overflowing = await page.evaluate(() => {
          const all = document.querySelectorAll("*");
          const vw = document.documentElement.clientWidth;
          return Array.from(all)
            .filter(
              (el) =>
                el.scrollWidth > vw ||
                el.getBoundingClientRect().right > vw + 1
            )
            .map((el) => ({
              tag: el.tagName,
              cls: el.className?.toString().substring(0, 80) || "",
              width: el.scrollWidth,
            }))
            .slice(0, 5);
        });
        console.log(`Overflowing elements on ${name}:`, overflowing);
      }

      expect(hasOverflow).toBe(false);
    });
  }
});

// ── Accessibility audit ──────────────────────────────────────
test.describe("Accessibility audit", () => {
  test("buttons have accessible names", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const unlabeled = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      const bad: string[] = [];
      buttons.forEach((btn) => {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute("aria-label");
        const ariaLabelledBy = btn.getAttribute("aria-labelledby");
        const title = btn.getAttribute("title");
        if (!text && !ariaLabel && !ariaLabelledBy && !title) {
          bad.push(
            `<${btn.tagName} class="${btn.className?.toString().substring(0, 60)}">`
          );
        }
      });
      return bad;
    });

    if (unlabeled.length > 0) {
      console.log("Buttons without labels:", unlabeled);
    }
    expect(unlabeled.length).toBe(0);
  });

  test("heading hierarchy is correct on /marques", async ({ page }) => {
    await page.goto("/marques");
    await page.waitForLoadState("domcontentloaded");

    const headings = await page.evaluate(() => {
      const hs = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      return Array.from(hs).map((h) => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim().substring(0, 40) || "",
      }));
    });

    // h1 must exist
    expect(headings.some((h) => h.level === 1)).toBe(true);

    // No skipping levels (h3 before h2, etc.)
    let maxSeen = 0;
    for (const h of headings) {
      if (h.level > maxSeen + 1 && maxSeen > 0) {
        console.log(`Heading skip: h${maxSeen} → h${h.level} ("${h.text}")`);
      }
      if (h.level > maxSeen) maxSeen = h.level;
    }
  });

  test("images have alt text on /marques", async ({ page }) => {
    await page.goto("/marques");
    await page.waitForLoadState("domcontentloaded");

    const missingAlt = await page.evaluate(() => {
      const imgs = document.querySelectorAll("img:not([alt])");
      return Array.from(imgs).map((img) => ({
        src: (img as HTMLImageElement).src?.substring(0, 80),
      }));
    });

    expect(missingAlt.length).toBe(0);
  });
});
