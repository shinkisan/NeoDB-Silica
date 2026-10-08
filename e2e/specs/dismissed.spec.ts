import { expect, test } from "@playwright/test";
import { BOOK_TITLE } from "../helpers/env";
import { signIn } from "../helpers/session";

test("hiding an item from the feed is recorded, and the profile page can undo it", async ({
  context,
  page,
}) => {
  const requests: string[] = [];

  await signIn(context);
  page.on("request", (request) => {
    const url = request.url();

    if (url.includes("/api/neodb/dismiss")) {
      requests.push(`${request.method()} ${url}`);
    }
  });

  await page.goto("/?category=book");

  // Long-press the card to reach the preview, then hide the item.
  const card = page.getByRole("link", { name: new RegExp(BOOK_TITLE) }).first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();

  if (!box) {
    throw new Error("home card has no bounding box");
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();

  await page.getByRole("button", { name: "不喜欢" }).click();
  await expect(page.getByText(BOOK_TITLE)).toHaveCount(0);
  await expect
    .poll(() => requests.some((request) => request.startsWith("POST")))
    .toBe(true);

  // The record is what the profile page lists.
  await page.goto("/profile/dismissed");

  await expect(page.getByText(BOOK_TITLE)).toBeVisible();

  await page.getByRole("button", { name: "取消屏蔽" }).click();

  await expect
    .poll(() => requests.some((request) => request.startsWith("DELETE")))
    .toBe(true);
  await expect(page.getByText(BOOK_TITLE)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "查看完整列表" })).toBeVisible();
});

test("the hidden list asks a guest to log in", async ({ page }) => {
  await page.goto("/profile/dismissed");

  await expect(page.getByText("登录后可以查看屏蔽的条目。")).toBeVisible();
});
