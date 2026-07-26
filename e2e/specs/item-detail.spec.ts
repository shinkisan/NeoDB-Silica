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
