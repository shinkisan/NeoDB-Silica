import { expect, test } from "@playwright/test";
import { BOOK_UUID, OTHER_COMMENT_TEXT } from "../helpers/env";
import { signIn } from "../helpers/session";

// Regression lock for the JSON big-integer precision bug, on the second
// endpoint it affects: /api/item/{uuid}/posts/ (unlike own-comment-reply.spec,
// which covers /api/me/shelf and /api/me/review). This endpoint emits both
// the post id and its author's account id as bare 18-digit JSON numbers. If
// the app ever regresses to plain JSON.parse there, the "view profile" link
// built from a corrupted account id 404s downstream instead of loading.
test("opening a commenter's profile from the item detail page works", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto(`/item/book/${BOOK_UUID}`);

  const otherComment = page
    .locator("article")
    .filter({ hasText: OTHER_COMMENT_TEXT })
    .first();
  await expect(otherComment).toBeVisible();

  await otherComment.getByRole("link", { name: "另一位用户" }).click();

  await expect(page).toHaveURL(/\/user\/600000000000000002/);
  await expect(page.getByText("另一位用户").first()).toBeVisible();
});
