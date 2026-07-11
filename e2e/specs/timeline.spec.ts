import { expect, test } from "@playwright/test";
import {
  OWN_COMMENT_TEXT,
  REMOTE_ITEM_NAME,
  REMOTE_ITEM_URL,
  REMOTE_SPOILER_CONTENT,
  REMOTE_SPOILER_WARNING,
  REVIEW_TEASER_TEXT,
} from "../helpers/env";
import { signIn } from "../helpers/session";

test("timeline shows the user's own activity", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/timeline");

  await page.getByRole("button", { name: "我的" }).click();

  await expect(page.getByText(OWN_COMMENT_TEXT).first()).toBeVisible();
});

test("a remote CW post with sensitive:false stays collapsed until revealed", async ({
  context,
  page,
}) => {
  // A remote post can carry a content-warning (spoiler_text) with
  // sensitive:false - Mastodon/ActivityPub treat sensitive as a separate
  // media-blur flag, not a proxy for "has a CW". The content must stay
  // hidden until the CW button is clicked, regardless of `sensitive`.
  await signIn(context);
  await page.goto("/timeline");
  await page.getByRole("button", { name: "好友" }).click();

  const warningButton = page.getByRole("button").filter({ hasText: REMOTE_SPOILER_WARNING });
  await expect(warningButton).toBeVisible();
  await expect(page.getByText(REMOTE_SPOILER_CONTENT)).not.toBeVisible();

  await warningButton.click();

  await expect(page.getByText(REMOTE_SPOILER_CONTENT)).toBeVisible();
});

test("a review's generic AP teaser text doesn't trigger a CW gate", async ({
  context,
  page,
}) => {
  // NeoDB sets spoiler_text unconditionally on every review crosspost as a
  // generic "a review of {title}" AP teaser - it's not a real spoiler
  // warning. Reviews must show their normal read-full-review teaser
  // directly, with no CW button in front of it.
  await signIn(context);
  await page.goto("/timeline");
  await page.getByRole("button", { name: "好友" }).click();

  await expect(
    page.getByRole("button").filter({ hasText: REVIEW_TEASER_TEXT }),
  ).not.toBeVisible();
  await expect(page.getByText("阅读全文")).toBeVisible();
});

test("a cross-instance item link stays external instead of a broken internal route", async ({
  context,
  page,
}) => {
  // ext_neodb.tag.href on a federated post points at the origin instance's
  // own local item uuid, which our connected instance has never heard of.
  // It must stay an external link, not get rewritten into a broken
  // internal /item/... route.
  await signIn(context);
  await page.goto("/timeline");
  await page.getByRole("button", { name: "好友" }).click();
  await page
    .getByRole("button")
    .filter({ hasText: REMOTE_SPOILER_WARNING })
    .click();

  const itemLink = page.getByRole("link", { name: new RegExp(REMOTE_ITEM_NAME) });
  await expect(itemLink).toBeVisible();
  await expect(itemLink).toHaveAttribute("href", REMOTE_ITEM_URL);
  await expect(itemLink).toHaveAttribute("target", "_blank");
});
