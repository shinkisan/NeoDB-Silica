import { expect, test } from "@playwright/test";
import {
  BOOK_TITLE,
  BOOK_UUID,
  MOVIE_UUID,
  OTHER_COMMENT_TEXT,
} from "../helpers/env";

test("item detail renders metadata and community comments", async ({ page }) => {
  await page.goto(`/item/book/${BOOK_UUID}`);

  await expect(
    page.getByRole("heading", { level: 1, name: BOOK_TITLE }),
  ).toBeVisible();

  // Rating value from the fixture.
  await expect(page.getByText("8.4").first()).toBeVisible();

  // Community short comments from the instance's item posts.
  await expect(page.getByText(OTHER_COMMENT_TEXT).first()).toBeVisible();
});

test("movie poster shows a skeleton until the image loads", async ({ page }) => {
  let releaseImage: (() => void) | undefined;
  const imageReleased = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });

  await page.route(`**/m/covers/${MOVIE_UUID}.png`, async (route) => {
    await imageReleased;
    await route.continue();
  });

  await page.goto(`/item/movie/${MOVIE_UUID}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("[data-detail-poster-skeleton]")).toBeVisible();
  releaseImage?.();

  await expect(page.locator("[data-detail-poster-image]")).toHaveClass(
    /opacity-100/,
  );
  await expect(page.locator("[data-detail-poster-skeleton]")).toHaveCount(0);
});

test("scrolled detail header centers the cover and returns to the top", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/item/book/${BOOK_UUID}`);
  await expect(page.getByRole("heading", { level: 1, name: BOOK_TITLE })).toBeVisible();

  const coverButton = page.locator("header button").filter({
    has: page.getByRole("img", { name: BOOK_TITLE, includeHidden: true }),
  });
  await expect(coverButton).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(coverButton).toHaveAttribute("aria-hidden", "false");
  await expect(page.getByRole("button", {
    name: "回到顶部", exact: true, includeHidden: true,
  })).toHaveCount(0);
  const bounds = await coverButton.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - 375 / 2)).toBeLessThan(2);

  await coverButton.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(coverButton).toHaveAttribute("aria-hidden", "true");
});

test("detail glass initializes on direct load without hydration errors", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydrat/i.test(error.message)) hydrationErrors.push(error.message);
  });

  await page.goto(`/item/book/${BOOK_UUID}`);
  await expect(page.getByRole("heading", { level: 1, name: BOOK_TITLE })).toBeVisible();
  const glass = page.locator("header .liquid-glass");
  await expect(glass).toHaveCount(3);
  for (const surface of await glass.all()) {
    await expect.poll(() => surface.evaluate((element) =>
      (element as HTMLElement).style.backdropFilter,
    )).toContain("#displace");
  }
  expect(hydrationErrors).toEqual([]);
});
