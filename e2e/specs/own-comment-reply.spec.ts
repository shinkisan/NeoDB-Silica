import { expect, test } from "@playwright/test";
import { BOOK_UUID, OWN_COMMENT_TEXT } from "../helpers/env";
import { signIn } from "../helpers/session";

// Regression lock for the JSON big-integer precision bug: the mock's
// /api/me/shelf/item/{uuid} emits post_id as a bare 18-digit JSON number
// (like real NeoDB). If the app ever parses it with plain JSON.parse again,
// the id corrupts, the own comment degrades to a synthetic local- entry, and
// this reply flow breaks.
test("replying to one's own comment works", async ({ context, page }) => {
  await signIn(context);
  await page.goto(`/item/book/${BOOK_UUID}`);

  const ownComment = page
    .locator("article")
    .filter({ hasText: OWN_COMMENT_TEXT })
    .first();
  await expect(ownComment).toBeVisible();

  // Expanding replies fetches /statuses/{post_id}/context — a corrupted id
  // 404s there and surfaces the "无法加载回复" error toast instead.
  await ownComment.getByRole("button", { name: "展开回复" }).click();
  await expect(page.getByText("暂无回复").first()).toBeVisible();
  await expect(page.getByText("暂时无法加载回复")).toHaveCount(0);

  await ownComment.getByLabel("写下回复").fill("端到端测试回复");
  await ownComment.getByRole("button", { name: "发送回复" }).click();

  // Replying to your own post triggers the auto-note guidance dialog.
  await expect(page.getByText("笔记创建提示").first()).toBeVisible();
  await page.getByRole("button", { name: "发送", exact: true }).click();

  await expect(page.getByText("回复已发送").first()).toBeVisible();
  await expect(page.getByText("端到端测试回复").first()).toBeVisible();
});
