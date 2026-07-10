import { expect, test } from "@playwright/test";
import { MOVIE_TITLE, MOVIE_UUID } from "../helpers/env";
import { signIn } from "../helpers/session";

test("marking an item as wishlist succeeds", async ({ context, page }) => {
  await signIn(context);
  await page.goto(`/item/movie/${MOVIE_UUID}`);

  await expect(
    page.getByRole("heading", { level: 1, name: MOVIE_TITLE }),
  ).toBeVisible();

  await page.getByRole("button", { name: "标记", exact: true }).click();
  await page.getByRole("option", { name: "想看", exact: true }).click();

  await expect(page.getByText("已标记").first()).toBeVisible();
});

test("submitting a rating and a short comment succeeds", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto(`/item/movie/${MOVIE_UUID}`);

  // Rating stars only show once the item is marked past "wishlist", so mark
  // it as watched first.
  await page.getByRole("button", { name: "标记", exact: true }).click();
  await page.getByRole("option", { name: "看过", exact: true }).click();
  await expect(page.getByText("已标记").first()).toBeVisible();

  await page.getByRole("button", { name: "写短评", exact: true }).click();
  await expect(page.getByText("写短评/打分").first()).toBeVisible();

  // Each of the 5 star buttons is a half-star toggle: clicking its right half
  // scores a full star. The 4th star's right half sets the 10-point rating
  // to 8 (getRatingFromPointer: starIndex * 2 + 2).
  await page
    .getByRole("button", { name: "4 星", exact: true })
    .click({ position: { x: 30, y: 22 } });
  await page
    .getByPlaceholder("写下你的想法...")
    .fill("端到端测试短评");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("已保存").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "修改短评", exact: true }),
  ).toBeVisible();

  // Dragging the rating row all the way to its left edge must reach 0 (clear
  // the rating) — unlike a plain tap on a star, which floors at 1 (half a
  // star). Regression test for a fix to getRatingFromRatingRow.
  await page.getByRole("button", { name: "修改短评", exact: true }).click();
  await expect(page.getByText("修改短评/打分").first()).toBeVisible();

  const firstStar = page.getByRole("button", { name: "1 星", exact: true });
  const ratingRow = firstStar.locator("..");
  const filledStars = ratingRow.locator('span[style*="width"]');
  await expect(filledStars).toHaveCount(4);

  // Drive the row's own pointer handlers directly (pointerdown on a star,
  // pointermove/up on the row, matching the component's actual listener
  // split) instead of emulating real mouse motion — a real drag that starts
  // and ends over the same star button also fires a native "click" there,
  // which re-floors the rating to 1 and would mask the bug this guards.
  const rowBox = await ratingRow.boundingBox();
  if (!rowBox) {
    throw new Error("rating row not found");
  }
  const y = rowBox.y + rowBox.height / 2;
  await firstStar.dispatchEvent("pointerdown", {
    bubbles: true,
    clientX: rowBox.x + 20,
    clientY: y,
    pointerId: 1,
  });
  // Land clearly past the row's left edge, not exactly on it — the app
  // computes the ratio from a live getBoundingClientRect() at move time, so
  // landing exactly at rowBox.x (measured earlier) can be a sub-pixel hair
  // to the right of that boundary and round up to 1 instead of clamping to
  // 0. A real drag naturally overshoots the edge; this mirrors that.
  await ratingRow.dispatchEvent("pointermove", {
    bubbles: true,
    clientX: rowBox.x - 10,
    clientY: y,
    pointerId: 1,
  });
  await ratingRow.dispatchEvent("pointerup", {
    bubbles: true,
    clientX: rowBox.x - 10,
    clientY: y,
    pointerId: 1,
  });

  await expect(filledStars).toHaveCount(0);

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存").first()).toBeVisible();
});
