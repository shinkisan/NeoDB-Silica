import { expect, test } from "@playwright/test";
import { BOOK_TITLE, OWN_COMMENT_TEXT } from "../helpers/env";
import { signIn } from "../helpers/session";

test("marked page lists shelf items", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/marked");

  // The fixture mark lives on the "complete" shelf.
  await page.getByRole("button", { name: "已完成" }).click();

  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();
  await expect(page.getByText(OWN_COMMENT_TEXT).first()).toBeVisible();
});

test("arriving from elsewhere defaults to the user's first reordered tag", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto("/marked");

  await page.getByRole("button", { name: "排序", exact: true }).click();
  await expect(page.getByText("标记分类排序").first()).toBeVisible();
  const allRow = page.locator("div").filter({ hasText: "全部" }).last();

  // Move "全部" (All) from first to last (7 categories after it).
  for (let step = 0; step < 7; step += 1) {
    await allRow.getByRole("button", { name: "下移" }).click();
  }

  await page.getByRole("button", { name: "关闭" }).click();

  // Leave the marked page, then arrive again the way the bottom nav does:
  // a bare link with no ?category= — regression test for a bug where this
  // always fell back to "all" instead of the user's saved first tag.
  await page.goto("/");
  await page.goto("/marked");

  await expect(page).toHaveURL(/\/marked$/);
  await expect(
    page.locator('[data-marked-category="book"]'),
  ).toHaveClass(/bg-\[#e2e2e5\]/);
});
