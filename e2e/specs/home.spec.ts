import { expect, test } from "@playwright/test";
import { BOOK_TITLE, BOOK_UUID } from "../helpers/env";

test("home renders trending items from the instance", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  // Trending rail populated from the mock instance.
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("home trending card opens the item's detail page", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("link", { name: new RegExp(BOOK_TITLE) })
    .first()
    .click();

  await expect(page).toHaveURL(new RegExp(`/item/book/${BOOK_UUID}`));
  await expect(
    page.getByRole("heading", { level: 1, name: BOOK_TITLE }),
  ).toBeVisible();
});

test("PWA shortcuts expose scan, search, and reading-book destinations", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  const manifest = (await response.json()) as {
    shortcuts?: Array<{
      icons?: Array<{ sizes: string; src: string; type: string }>;
      name: string;
      url: string;
    }>;
  };

  expect(manifest.shortcuts).toEqual([
    expect.objectContaining({
      icons: [
        {
          sizes: "96x96",
          src: "/icons/shortcut-scan-book.png",
          type: "image/png",
        },
      ],
      name: expect.any(String),
      url: "/?shortcut=scan-book",
    }),
    expect.objectContaining({
      icons: [
        {
          sizes: "96x96",
          src: "/icons/shortcut-search.png",
          type: "image/png",
        },
      ],
      name: expect.any(String),
      url: "/?shortcut=search",
    }),
    expect.objectContaining({
      icons: [
        {
          sizes: "96x96",
          src: "/icons/shortcut-reading-progress.png",
          type: "image/png",
        },
      ],
      name: expect.any(String),
      url: "/marked?shelf=progress&category=book",
    }),
  ]);
});

test("home PWA search shortcut focuses the search field once", async ({
  page,
}) => {
  await page.goto("/?shortcut=search");

  const input = page.locator('input[name="app-home-search-query"]');
  await expect(input).toBeFocused();
  await expect(page).toHaveURL("/");
});

test("home PWA scan shortcut opens and closes the ISBN scanner", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/?shortcut=scan-book");

  const scanner = page.locator("video");
  await expect(scanner).toBeVisible();
  await scanner.locator("xpath=ancestor::section").getByRole("button").click();

  await expect(scanner).toHaveCount(0);
  await expect(page).toHaveURL("/");
  expect(pageErrors).toEqual([]);
});
