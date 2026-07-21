import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { getItemApiPath } from "@/lib/neodb";
import { normalizeIsbn } from "@/lib/isbn";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000";

type GoogleBooksVolume = {
  volumeInfo?: {
    industryIdentifiers?: Array<{
      identifier?: string;
      type?: string;
    }>;
    pageCount?: number;
  };
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
};

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "google-books:page-count",
    limit: 60,
    request,
    windowMs: 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { pageCount: null },
      {
        headers: { "Retry-After": String(rateLimit.retryAfter) },
        status: 429,
      },
    );
  }

  const requestUrl = new URL(request.url);
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  const requestedIsbn = normalizeIsbn(requestUrl.searchParams.get("isbn") || "");
  const itemUuid = normalizeItemUuid(requestUrl.searchParams.get("itemUuid"));

  if (!requestedIsbn && !itemUuid) {
    return NextResponse.json({ pageCount: null }, { status: 400 });
  }

  const itemMetadata = itemUuid
    ? await fetchBookMetadata(itemUuid)
    : null;

  if (itemMetadata?.pageCount) {
    return NextResponse.json(
      { pageCount: itemMetadata.pageCount, source: "item" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const isbn = itemMetadata?.isbn || requestedIsbn;

  if (!apiKey || !isbn) {
    return NextResponse.json(
      { pageCount: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  configureServerFetchProxy();

  try {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", `isbn:${isbn}`);
    url.searchParams.set("maxResults", "5");
    url.searchParams.set("projection", "full");
    url.searchParams.set("key", apiKey);

    const response = await fetchWithTimeout(
      url,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 60 * 24 * 30 },
      },
      5_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { pageCount: null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const payload = (await response.json()) as GoogleBooksResponse;
    const pageCount = findMatchingPageCount(payload.items || [], isbn);

    return NextResponse.json(
      { pageCount, source: pageCount ? "google" : null },
      {
        headers: {
          "Cache-Control": itemUuid ? "private, no-store" : CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    console.error("[google-books] page count lookup failed", error);
    return NextResponse.json(
      { pageCount: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

async function fetchBookMetadata(itemUuid: string) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.instance) {
    return null;
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}${getItemApiPath("book", itemUuid)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        next: { revalidate: 60 * 30 },
      },
      5_000,
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      isbn?: unknown;
      pages?: unknown;
    };
    const pageCount = normalizePageCount(payload.pages);

    return {
      isbn: normalizeIsbn(typeof payload.isbn === "string" ? payload.isbn : ""),
      pageCount,
    };
  } catch (error) {
    console.error("[google-books] NeoDB book metadata lookup failed", error);
    return null;
  }
}

function findMatchingPageCount(items: GoogleBooksVolume[], isbn: string) {
  for (const item of items) {
    const identifiers = item.volumeInfo?.industryIdentifiers || [];
    const matches = identifiers.some(
      ({ identifier = "" }) => normalizeIsbn(identifier) === isbn,
    );
    const pageCount = Number(item.volumeInfo?.pageCount);

    if (
      matches &&
      Number.isInteger(pageCount) &&
      pageCount > 0 &&
      pageCount <= 100_000
    ) {
      return pageCount;
    }
  }

  return null;
}

function normalizeItemUuid(value: string | null) {
  const normalized = value?.trim() || "";

  return /^[A-Za-z0-9_-]{6,64}$/.test(normalized) ? normalized : "";
}

function normalizePageCount(value: unknown) {
  const pageCount = Number(value);

  return Number.isInteger(pageCount) && pageCount > 0 && pageCount <= 100_000
    ? pageCount
    : null;
}
