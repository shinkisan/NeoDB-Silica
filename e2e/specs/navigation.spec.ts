import { expect, test } from "@playwright/test";
import { BOTTOM_TAB_ORDER_KEY } from "../../src/lib/bottom-tabs";

test("bottom navigation switches between root tabs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "标记" }).click();
  await expect(page).toHaveURL(/\/marked/);

  await page.getByRole("link", { name: "账户" }).click();
  await expect(page).toHaveURL(/\/profile/);

  await page.getByRole("link", { name: "发现" }).click();
  await expect(page).toHaveURL(new RegExp("/$"));
});

test("bottom navigation follows the saved tab order", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ key, order }) => window.localStorage.setItem(key, JSON.stringify(order)),
    {
      key: BOTTOM_TAB_ORDER_KEY,
      order: ["profile", "marked", "timeline", "discover"],
    },
  );
  await page.reload();

  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link"),
  ).toHaveText(["账户", "标记", "动态", "发现"]);
});
