import { expect, test } from "@playwright/test";
import { BOOK_TITLE, BOOK_UUID } from "../helpers/env";

test("home renders trending items from the instance", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  // Trending rail populated from the mock instance.
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("home trending card opens the item's detail page", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("link", { name: new RegExp(BOOK_TITLE) })
    .first()
    .click();

  await expect(page).toHaveURL(new RegExp(`/item/book/${BOOK_UUID}`));
  await expect(
    page.getByRole("heading", { level: 1, name: BOOK_TITLE }),
  ).toBeVisible();
});
