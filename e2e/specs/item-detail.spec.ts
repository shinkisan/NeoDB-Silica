import { expect, test } from "@playwright/test";
import { BOOK_TITLE, BOOK_UUID, OTHER_COMMENT_TEXT } from "../helpers/env";

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
