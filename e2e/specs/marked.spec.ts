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
  await page.route("**/api/neodb/progress*", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        type: string;
        value: string;
      };

      await route.fulfill({ json: { type: body.type, value: body.value } });
      return;
    }

    await route.fulfill({
      json: {
        items: {
          [BOOK_UUID]: { type: "page", value: String(progressPage) },
        },
      },
    });
  });
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
  const expectedPercentage = Math.round(expectedRatio * 100);
  const badge = page.locator("[data-reading-progress-percentage]");

  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute(
    "data-reading-progress-percentage",
    String(expectedPercentage),
  );
  await expect(badge).toContainText(`（${expectedPercentage}%）`);
  await expect
    .poll(async () => {
      const badgeWidth = await badge.evaluate((element) =>
        element.getBoundingClientRect().width,
      );
      const fillWidth = await badge
        .locator("[data-reading-progress-fill]")
        .evaluate((element) => element.getBoundingClientRect().width);

      return fillWidth / badgeWidth;
    })
    .toBeCloseTo(expectedPercentage / 100, 2);
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

test("no percentage is added when no total page count is available", async ({
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
  await expect(page.locator("[data-reading-progress-percentage]")).toHaveCount(0);
});

test("the percentage input supports direct and stepped changes", async ({
  context,
  page,
}) => {
  await signIn(context);
  await mockProgressCard(page, {
    googlePageCount: null,
    itemPageCount: null,
  });

  await page.goto("/marked?shelf=progress&category=book");
  await page.getByRole("button", { name: "设置阅读进度" }).click();
  await page.getByRole("radio", { name: "百分比" }).click();

  const percentageInput = page.getByRole("spinbutton", {
    name: "当前进度",
  });
  await page.getByRole("button", { name: "增加百分比" }).click();
  await expect(percentageInput).toHaveValue("1");

  await percentageInput.click();
  await page.keyboard.press("Backspace");
  await expect(percentageInput).toHaveValue("");
  await expect(page.getByRole("button", { name: "确认" })).toBeDisabled();
  await page.keyboard.type("42");
  await expect(percentageInput).toHaveValue("42");

  await percentageInput.press("e");
  await percentageInput.press("-");
  await percentageInput.press(".");
  await expect(percentageInput).toHaveValue("42");

  await page.getByRole("button", { name: "增加百分比" }).click();
  await expect(percentageInput).toHaveValue("43");
  await page.getByRole("button", { name: "减少百分比" }).click();
  await expect(percentageInput).toHaveValue("42");

  const box = await percentageInput.boundingBox();
  if (!box) {
    throw new Error("Percentage input was not rendered");
  }

  await percentageInput.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.8,
    clientY: box.y + box.height / 2,
    isPrimary: true,
    pointerId: 42,
    pointerType: "touch",
  });
  await percentageInput.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height / 2,
    isPrimary: true,
    pointerId: 42,
    pointerType: "touch",
  });

  await expect(page.getByRole("heading", { name: /标记进度/ })).toBeVisible();
  await expect(page).toHaveURL(/category=book/);

  for (const mode of [
    { current: "当前页码", label: "页码", total: "总页数" },
    { current: "当前章节", label: "章节", total: "总章节数" },
  ]) {
    await page.getByRole("radio", { name: mode.label }).click();
    const currentInput = page.getByRole("spinbutton", {
      name: mode.current,
    });
    const totalInput = page.getByRole("spinbutton", { name: mode.total });

    await currentInput.fill("12");
    await currentInput.press("e");
    await currentInput.press("-");
    await currentInput.press(".");
    await expect(currentInput).toHaveValue("12");
    await currentInput.click();
    await page.keyboard.type("13");
    await expect(currentInput).toHaveValue("13");

    await totalInput.fill("20");
    await totalInput.press("e");
    await totalInput.press("-");
    await totalInput.press(".");
    await expect(totalInput).toHaveValue("20");
    await totalInput.click();
    await page.keyboard.type("21");
    await expect(totalInput).toHaveValue("21");
  }
});

test("a manual total shows the local-data warning only once", async ({
  context,
  page,
}) => {
  await signIn(context);
  await mockProgressCard(page, {
    googlePageCount: null,
    itemPageCount: null,
  });

  await page.goto("/marked?shelf=progress&category=book");
  await page.getByRole("button", { name: "设置阅读进度" }).click();
  await page.getByRole("spinbutton", { name: "总页数" }).fill("200");
  await page.getByRole("button", { name: "确认" }).click();

  await expect(
    page.getByRole("heading", { name: "本地数据提示" }),
  ).toBeVisible();
  await expect(page.getByText("这些数据将会丢失", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "继续保存" }).click();
  await expect(page.getByText("阅读进度已更新")).toBeVisible();

  await page.getByRole("button", { name: "设置阅读进度" }).click();
  await page.getByRole("spinbutton", { name: "总页数" }).fill("300");
  await page.getByRole("button", { name: "确认" }).click();

  await expect(
    page.getByRole("heading", { name: "本地数据提示" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /标记进度/ }),
  ).toHaveCount(0);
});
