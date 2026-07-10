import { expect, test } from "@playwright/test";

test("bottom navigation switches between root tabs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "标记" }).click();
  await expect(page).toHaveURL(/\/marked/);

  await page.getByRole("link", { name: "账户" }).click();
  await expect(page).toHaveURL(/\/profile/);

  await page.getByRole("link", { name: "发现" }).click();
  await expect(page).toHaveURL(new RegExp("/$"));
});
