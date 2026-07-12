import { expect, test } from "@playwright/test";
import { BOOK_TITLE, BOOK_UUID } from "../helpers/env";

test("search finds a catalog item and opens its detail page", async ({ page }) => {
  await page.goto("/");

  const searchInput = page.getByPlaceholder("搜索条目或链接……").first();
  await searchInput.fill("测试之书");
  await searchInput.press("Enter");

  // The mock's trending fixture reuses the same book, so it also renders as
  // a card on the home page itself. next dev compiles /search on first
  // visit, so the browser can still be showing the old home page - with its
  // own matching trending-card link - for a beat after Enter fires the
  // navigation. Wait for the URL to actually land on /search first so the
  // locator below can only match the real search-results link.
  await page.waitForURL(/\/search\?/);

  const result = page.getByRole("link", { name: new RegExp(BOOK_TITLE) }).first();
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(new RegExp(`/item/book/${BOOK_UUID}`));
  await expect(
    page.getByRole("heading", { level: 1, name: BOOK_TITLE }),
  ).toBeVisible();
});
