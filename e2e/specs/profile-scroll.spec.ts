import { expect, test } from "@playwright/test";
import { STORAGE_PREFIX } from "../../src/lib/runtime-ids";
import { signIn } from "../helpers/session";

test("a sub-page opens at its top, and the profile page returns to where it was", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto("/profile");
  await page.waitForSelector('a[href="/profile/tags"]');

  // What the page can actually reach is what the row records, so take the
  // measured position rather than the requested one.
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(100);
  const leftAt = await page.evaluate(() => window.scrollY);

  expect(leftAt).toBeGreaterThan(0);

  await page.locator('a[href="/profile/tags"]').click();
  await expect(page).toHaveURL(/\/profile\/tags/);

  // Clicking scrolls the row into view, so what the row recorded is the
  // position to compare against, not the one this test set.
  const recorded = await page.evaluate(
    (key) => Number(window.sessionStorage.getItem(key)),
    `${STORAGE_PREFIX}v1:scroll-memory:profile`,
  );

  expect(recorded).toBeGreaterThan(0);

  // The sub-page starts at the top rather than inheriting the offset.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/profile$/);

  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(recorded - 2);
});
