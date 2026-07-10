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
