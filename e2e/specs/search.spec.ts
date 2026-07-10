import { expect, test } from "@playwright/test";
import { BOOK_TITLE, BOOK_UUID } from "../helpers/env";

test("search finds a catalog item and opens its detail page", async ({ page }) => {
  await page.goto("/");

  const searchInput = page.getByPlaceholder("搜索条目或链接……").first();
  await searchInput.fill("测试之书");
  await searchInput.press("Enter");

  const result = page.getByRole("link", { name: new RegExp(BOOK_TITLE) }).first();
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(new RegExp(`/item/book/${BOOK_UUID}`));
  await expect(
    page.getByRole("heading", { level: 1, name: BOOK_TITLE }),
  ).toBeVisible();
});
