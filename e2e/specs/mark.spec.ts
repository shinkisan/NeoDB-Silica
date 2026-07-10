import { expect, test } from "@playwright/test";
import { MOVIE_TITLE, MOVIE_UUID } from "../helpers/env";
import { signIn } from "../helpers/session";

test("marking an item as wishlist succeeds", async ({ context, page }) => {
  await signIn(context);
  await page.goto(`/item/movie/${MOVIE_UUID}`);

  await expect(
    page.getByRole("heading", { level: 1, name: MOVIE_TITLE }),
  ).toBeVisible();

  await page.getByRole("button", { name: "标记", exact: true }).click();
  await page.getByRole("option", { name: "想看", exact: true }).click();

  await expect(page.getByText("已标记").first()).toBeVisible();
});
