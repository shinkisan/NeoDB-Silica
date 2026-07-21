import { expect, test, type Page } from "@playwright/test";
import {
  BOOK_TITLE,
  BOOK_UUID,
  MOCK_ORIGIN,
  OWN_COMMENT_TEXT,
} from "../helpers/env";
import { signIn } from "../helpers/session";
import { STORAGE_PREFIX } from "../../src/lib/runtime-ids";

const progressPage = 20;

function markedProgressPayload(pageCount: number | null) {
  return {
    count: 1,
    items: [
      {
        item: {
          apiPath: `/api/book/${BOOK_UUID}`,
          category: "book",
          categoryLabel: "图书",
          coverUrl: null,
          creator: null,
          description: "",
          detailPath: `/item/book/${BOOK_UUID}`,
          href: `${MOCK_ORIGIN}/book/${BOOK_UUID}`,
          id: BOOK_UUID,
          isbn: "9780000000002",
          kind: "item",
          pages: pageCount,
          rating: null,
          ratingCount: null,
          tags: [],
          title: BOOK_TITLE,
        },
        mark: {
          comment_text: "",
          created_time: "2026-07-01T12:00:00.000Z",
          item: { category: "book", uuid: BOOK_UUID },
          rating_grade: 0,
          shelf_type: "progress",
        },
      },
    ],
    pages: 1,
  };
}

async function mockProgressCard(
  page: Page,
  {
    googlePageCount,
    itemPageCount,
  }: {
    googlePageCount: number | null;
    itemPageCount: number | null;
  },
) {
  let googleRequests = 0;

  await page.route("**/api/neodb/marks?*", (route) =>
    route.fulfill({ json: markedProgressPayload(itemPageCount) }),
  );
  await page.route("**/api/neodb/progress?*", (route) =>
    route.fulfill({
      json: {
        items: {
          [BOOK_UUID]: { type: "page", value: String(progressPage) },
        },
      },
    }),
  );
  await page.route("**/api/google-books/page-count?*", (route) => {
    googleRequests += 1;
    return route.fulfill({
      json: {
        pageCount: googlePageCount,
        source: googlePageCount ? "google" : null,
      },
    });
  });

  return () => googleRequests;
}

async function expectProgressRatio(
  page: Page,
  expectedRatio: number,
) {
  const track = page.locator(".reading-progress-track");
  const fill = page.locator(".reading-progress-fill");

  await expect(track).toBeVisible();
  await expect
    .poll(async () => {
      const trackWidth = await track.evaluate((element) =>
        element.getBoundingClientRect().width,
      );
      const fillWidth = await fill.evaluate((element) =>
        element.getBoundingClientRect().width,
      );

      return fillWidth / trackWidth;
    })
    .toBeCloseTo(expectedRatio, 2);
}

test("marked page lists shelf items", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/marked");

  // The fixture mark lives on the "complete" shelf.
  await page.getByRole("button", { name: "已完成" }).click();

  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();
  await expect(page.getByText(OWN_COMMENT_TEXT).first()).toBeVisible();
});

test("arriving from elsewhere defaults to the user's first reordered tag", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto("/marked");

  await page.getByRole("button", { name: "排序", exact: true }).click();
  await expect(page.getByText("标记分类排序").first()).toBeVisible();
  const allRow = page.locator("div").filter({ hasText: "全部" }).last();

  // Move "全部" (All) from first to last (7 categories after it).
  for (let step = 0; step < 7; step += 1) {
    await allRow.getByRole("button", { name: "下移" }).click();
  }

  await page.getByRole("button", { name: "关闭" }).click();

  // Leave the marked page, then arrive again the way the bottom nav does:
  // a bare link with no ?category= — regression test for a bug where this
  // always fell back to "all" instead of the user's saved first tag.
  await page.goto("/");
  await page.goto("/marked");

  await expect(page).toHaveURL(/\/marked$/);
  await expect(
    page.locator('[data-marked-category="book"]'),
  ).toHaveClass(/bg-\[#e2e2e5\]/);
});

test("a saved manual page total stays ahead of the item page count", async ({
  context,
  page,
}) => {
  await signIn(context);
  const getGoogleRequests = await mockProgressCard(page, {
    googlePageCount: 200,
    itemPageCount: 100,
  });

  await page.goto("/marked?shelf=progress&category=book");
  await expectProgressRatio(page, progressPage / 100);

  await page.evaluate(({ itemUuid, storagePrefix }) => {
    const scope = window.localStorage.getItem(
      `${storagePrefix}v1:marked-list:active-scope`,
    );

    if (!scope) {
      throw new Error("Marked cache scope was not initialized");
    }

    window.localStorage.setItem(
      `${storagePrefix}v1:reading-progress-total:${scope}:${itemUuid}`,
      JSON.stringify({ page: { source: "manual", value: 400 } }),
    );
  }, { itemUuid: BOOK_UUID, storagePrefix: STORAGE_PREFIX });
  await page.reload();

  await expectProgressRatio(page, progressPage / 400);
  expect(getGoogleRequests()).toBe(0);
});

test("the item page count is used without requesting Google Books", async ({
  context,
  page,
}) => {
  await signIn(context);
  const getGoogleRequests = await mockProgressCard(page, {
    googlePageCount: 200,
    itemPageCount: 100,
  });

  await page.goto("/marked?shelf=progress&category=book");

  await expectProgressRatio(page, progressPage / 100);
  expect(getGoogleRequests()).toBe(0);
});

test("Google Books supplies the total when the item has no page count", async ({
  context,
  page,
}) => {
  await signIn(context);
  const getGoogleRequests = await mockProgressCard(page, {
    googlePageCount: 200,
    itemPageCount: null,
  });

  await page.goto("/marked?shelf=progress&category=book");

  await expectProgressRatio(page, progressPage / 200);
  expect(getGoogleRequests()).toBe(1);
});

test("no progress bar is shown when no total page count is available", async ({
  context,
  page,
}) => {
  await signIn(context);
  const getGoogleRequests = await mockProgressCard(page, {
    googlePageCount: null,
    itemPageCount: null,
  });

  await page.goto("/marked?shelf=progress&category=book");
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();
  await expect.poll(getGoogleRequests).toBe(1);
  await expect(page.locator(".reading-progress-track")).toHaveCount(0);
});
