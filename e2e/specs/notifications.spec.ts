import { expect, test } from "@playwright/test";
import { MY_BRIDGE_DISPLAY_NAME, OTHER_DISPLAY_NAME } from "../helpers/env";
import { signIn } from "../helpers/session";

test("a boost from the user's own bridged fediverse account doesn't show up as a notification", async ({
  context,
  page,
}) => {
  // When the user's NeoDB account is bridged to a fediverse account (e.g.
  // Mastodon) they've linked via OAuth, that bridged account boosting one of
  // their own posts still arrives as an ordinary reblog notification from a
  // "different" actor - it's the user's own action re-notifying them, so it
  // must be filtered out. A genuine third-party reblog must still show up.
  await signIn(context);
  await page.goto("/timeline/notifications");

  await expect(page.getByText(OTHER_DISPLAY_NAME)).toBeVisible();
  await expect(page.getByText(MY_BRIDGE_DISPLAY_NAME)).not.toBeVisible();
});
