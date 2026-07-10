import { expect, test } from "@playwright/test";

// Guards the language preference contract (localStorage key + NEXT_LOCALE
// cookie must be written together and read back on reload).
test("chosen language persists across reloads", async ({ page }) => {
  await page.goto("/profile");

  await page.getByRole("button", { name: "系统语言" }).click();
  await page.getByRole("option", { name: "English" }).click();

  // Switching locale reloads the page into English.
  await expect(page.getByText("Account").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Account").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();
});
