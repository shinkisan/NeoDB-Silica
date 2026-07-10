import { expect, test } from "@playwright/test";
import { BOOK_TITLE } from "../helpers/env";

test("home renders trending items from the instance", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  // Trending rail populated from the mock instance.
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});
