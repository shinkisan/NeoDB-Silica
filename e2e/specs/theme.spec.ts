import { expect, test } from "@playwright/test";

test("Safari keeps the CSS liquid-glass fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    });
  });

  await page.goto("/");

  const glass = page.locator(".liquid-glass").first();
  await expect(glass).toBeVisible();
  await expect
    .poll(() =>
      glass.evaluate((element) => ({
        computed: getComputedStyle(element).backdropFilter,
        inline: (element as HTMLElement).style.backdropFilter,
      })),
    )
    .toEqual({ computed: expect.stringContaining("blur(16px)"), inline: "" });
});

// Guards the theme-color storage contract: picking a color must survive a
// reload (localStorage writer and the boot-time reader must agree on the key).
test("chosen theme color persists across reloads", async ({ page }) => {
  await page.goto("/profile");

  const readPrimary = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--theme-primary")
        .trim(),
    );
  const readBrowserThemeColor = () =>
    page.evaluate(
      () =>
        document.head.querySelector<HTMLMetaElement>(
          'meta[name="theme-color"]',
        )?.content || "",
    );

  const initialPrimary = await readPrimary();

  // The theme color dropdown shows the default color's label (石墨/slate).
  await page.getByRole("button", { name: "石墨" }).click();
  await page.getByRole("option", { name: "琥珀" }).click();

  await expect.poll(readPrimary).toBe("#9f6f2e");
  await expect.poll(readBrowserThemeColor).toBe("#9f6f2e");
  expect(initialPrimary).not.toBe("#9f6f2e");

  await page.reload();

  await expect.poll(readPrimary).toBe("#9f6f2e");
  await expect.poll(readBrowserThemeColor).toBe("#9f6f2e");
  await expect(page.getByRole("button", { name: "琥珀" })).toBeVisible();

  await page.getByRole("link", { name: "发现" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(readBrowserThemeColor).toBe("#9f6f2e");
});
