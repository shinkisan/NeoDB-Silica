import { expect, test } from "@playwright/test";

// Guards the theme-color storage contract: picking a color must survive a
// reload (localStorage writer and the boot-time reader must agree on the key).
test("chosen theme color persists across reloads", async ({ page }) => {
  await page.goto("/profile");

  const readPrimary = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--theme-primary")
        .trim(),
    );

  const initialPrimary = await readPrimary();

  // The theme color dropdown shows the default color's label (石墨/slate).
  await page.getByRole("button", { name: "石墨" }).click();
  await page.getByRole("option", { name: "琥珀" }).click();

  await expect.poll(readPrimary).toBe("#9f6f2e");
  expect(initialPrimary).not.toBe("#9f6f2e");

  await page.reload();

  await expect.poll(readPrimary).toBe("#9f6f2e");
  await expect(page.getByRole("button", { name: "琥珀" })).toBeVisible();
});
