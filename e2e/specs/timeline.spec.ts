import { expect, test } from "@playwright/test";
import { OWN_COMMENT_TEXT } from "../helpers/env";
import { signIn } from "../helpers/session";

test("timeline shows the user's own activity", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/timeline");

  await page.getByRole("button", { name: "我的" }).click();

  await expect(page.getByText(OWN_COMMENT_TEXT).first()).toBeVisible();
});
