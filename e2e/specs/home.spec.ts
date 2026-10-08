import { expect, test } from "@playwright/test";
import { BOOK_TITLE, BOOK_UUID, MOVIE_TITLE } from "../helpers/env";
import { signIn } from "../helpers/session";

test("home renders trending items from the instance", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/?category=book");

  // Trending rail populated from the mock instance.
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("home trending card opens the item's detail page", async ({ page }) => {
  await page.goto("/?category=book");

  await page
    .getByRole("link", { name: new RegExp(BOOK_TITLE) })
    .first()
    .click();

  await expect(page).toHaveURL(new RegExp(`/item/book/${BOOK_UUID}`));
  await expect(
    page.getByRole("heading", { level: 1, name: BOOK_TITLE }),
  ).toBeVisible();
});

test("a guest gets the public feed, without the personal tag", async ({
  page,
}) => {
  await page.goto("/?category=forYou");

  // The personal feed needs a session, so it is neither offered nor routable:
  // the category falls back to a public one.
  await expect(
    page.getByRole("button", { name: "推荐", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();
});

test("an expired session falls back to the log-in notice", async ({
  context,
  page,
}) => {
  await signIn(context, { accessToken: "expired-token" });
  await page.goto("/?category=forYou");

  await expect(page.getByRole("link", { name: "登录 NeoDB" })).toBeVisible();
});

test("the personal feed shows recommendations once signed in", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto("/?category=forYou");

  // Seeded picks land in 为你推荐 …
  await expect(page.getByText(BOOK_TITLE).first()).toBeVisible();

  // … and unseeded ones in 来自关注的人.
  await page.getByRole("button", { name: "来自关注的人" }).click();
  await expect(page.getByText(MOVIE_TITLE).first()).toBeVisible();
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

test("a supported site link is submitted for fetching, a plain URL is searched", async ({
  page,
}) => {
  const fetches: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/neodb/catalog-fetch")) {
      fetches.push(request.url());
    }
  });

  // MyAnimeList is a site NeoDB supports and the old hostname list never
  // listed, so this only reaches the fetch route because the site patterns —
  // generated from NeoDB's own source — decide it does.
  await page.goto("/?shortcut=search");
  await page
    .locator('input[name="app-home-search-query"]')
    .fill("https://myanimelist.net/anime/21");
  await page.locator('input[name="app-home-search-query"]').press("Enter");

  await expect
    .poll(() => fetches.some((url) => url.includes("myanimelist")))
    .toBe(true);
  await expect(page).toHaveURL(/\/search\?/);

  // A URL no site claims is searched as text, without asking NeoDB about it.
  fetches.length = 0;
  await page.goto("/?shortcut=search");
  await page
    .locator('input[name="app-home-search-query"]')
    .fill("https://example.com/post/1");
  await page.locator('input[name="app-home-search-query"]').press("Enter");

  await expect(page).toHaveURL(/\/search\?/);
  expect(fetches).toEqual([]);
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

test("ISBN scanner falls back to WASM when BarcodeDetector is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: undefined,
    });

    const leftPatterns = {
      L: [
        "0001101",
        "0011001",
        "0010011",
        "0111101",
        "0100011",
        "0110001",
        "0101111",
        "0111011",
        "0110111",
        "0001011",
      ],
      G: [
        "0100111",
        "0110011",
        "0011011",
        "0100001",
        "0011101",
        "0111001",
        "0000101",
        "0010001",
        "0001001",
        "0010111",
      ],
    } as const;
    const rightPatterns = [
      "1110010",
      "1100110",
      "1101100",
      "1000010",
      "1011100",
      "1001110",
      "1010000",
      "1000100",
      "1001000",
      "1110100",
    ];
    const isbn = "9780000000002";
    const parity = "LGGLGL";
    const left = isbn
      .slice(1, 7)
      .split("")
      .map((digit, index) =>
        leftPatterns[parity[index] as "L" | "G"][Number(digit)],
      )
      .join("");
    const right = isbn
      .slice(7)
      .split("")
      .map((digit) => rightPatterns[Number(digit)])
      .join("");
    const modules = `101${left}01010${right}101`;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const moduleWidth = 4;
    const barcodeWidth = modules.length * moduleWidth;
    const barcodeX = (720 - barcodeWidth) / 2;

    canvas.width = 720;
    canvas.height = 480;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";

    for (const [index, module] of [...modules].entries()) {
      if (module === "1") {
        context.fillRect(barcodeX + index * moduleWidth, 130, moduleWidth, 220);
      }
    }

    // Headless Chromium can render canvas-backed camera streams as a 2x2
    // black video. Present the synthetic barcode canvas as the video frame
    // so the spec exercises the WASM fallback rather than the GPU stack.
    for (const dimension of ["videoWidth", "videoHeight"] as const) {
      Object.defineProperty(HTMLVideoElement.prototype, dimension, {
        configurable: true,
        get: () => canvas[dimension === "videoWidth" ? "width" : "height"],
      });
    }
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    Object.defineProperty(CanvasRenderingContext2D.prototype, "drawImage", {
      configurable: true,
      value(
        this: CanvasRenderingContext2D,
        source: CanvasImageSource,
        ...args: unknown[]
      ) {
        return Reflect.apply(originalDrawImage, this, [
          source instanceof HTMLVideoElement ? canvas : source,
          ...args,
        ]);
      },
    });

    const stream = canvas.captureStream(5);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
      },
    });

    // Keep the canvas alive for the duration of the synthetic camera stream.
    Object.assign(window, { __appIsbnScannerCanvas: canvas });
  });

  await page.goto("/?shortcut=scan-book");

  await expect(page).toHaveURL(
    "/search?q=9780000000002&category=book",
    { timeout: 30_000 },
  );
});
