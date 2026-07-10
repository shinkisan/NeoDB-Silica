import { expect, test } from "@playwright/test";
import { MY_DISPLAY_NAME } from "../helpers/env";
import { signIn } from "../helpers/session";

// Guards the session cookie contract: a cookie minted with the app's own
// name + sealing format must be accepted, and logout must clear it.
test("minted session cookie signs the user in; logout signs out", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto("/profile");

  await expect(page.getByText(MY_DISPLAY_NAME).first()).toBeVisible();

  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "退出", exact: true }).click();

  await expect(page.getByRole("link", { name: /登录/ }).first()).toBeVisible();
});
