import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { locales } from "@/i18n/config";
import {
  getNeodbBaseUrl,
  normalizeNeodbCollection,
  type HomeItem,
  type NeodbCollection,
} from "@/lib/neodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { applyCollectionFallbackCover } from "@/lib/collection-fallback-cover";
import {
  configureServerFetchProxy,
  fetchWithTimeout,
  localeToNeoDBAcceptLanguage,
} from "@/lib/server-fetch";
import featuredCollections from "@/data/featured-collections.json";

const FEATURED_COLLECTIONS_CACHE_CONTROL =
  "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600";

type FeaturedCollectionEntry =
  (typeof featuredCollections.sections)[number]["collections"][number];

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "neodb:featured-collections",
    limit: 60,
    request,
    windowMs: 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试。" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfter) },
        status: 429,
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get("locale") || "";
  const resolvedLocale = (locales as readonly string[]).includes(localeParam)
    ? localeParam
    : (await cookies()).get("NEXT_LOCALE")?.value || "default";
  const acceptLanguage = localeToNeoDBAcceptLanguage(resolvedLocale) || null;
  const baseUrl = getNeodbBaseUrl();

  configureServerFetchProxy();

  const sections = (
    await Promise.all(
      featuredCollections.sections.map(async (section) => ({
        id: section.id,
        items: (
          await Promise.all(
            section.collections.map((collection) =>
              fetchFeaturedCollection(collection, baseUrl, {
                acceptLanguage,
                locale: resolvedLocale,
              }),
            ),
          )
        ).filter((item): item is HomeItem => item !== null),
        title: section.title,
      })),
    )
    // Drop sections whose collections don't exist on this instance, so other
    // deployments don't render broken rails from another instance's curation.
  ).filter((section) => section.items.length > 0);

  const responseHeaders = new Headers({
    "Cache-Control": FEATURED_COLLECTIONS_CACHE_CONTROL,
    "Vercel-CDN-Cache-Control": FEATURED_COLLECTIONS_CACHE_CONTROL,
  });

  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      sections: sections.map((section) => ({
        ...section,
        items: section.items.map(toHomeCardItem),
      })),
      source: baseUrl,
    },
    { headers: responseHeaders },
  );
}

async function fetchFeaturedCollection(
  entry: FeaturedCollectionEntry,
  baseUrl: string,
  {
    acceptLanguage,
    locale,
  }: {
    acceptLanguage: string | null;
    locale: string;
  },
): Promise<HomeItem | null> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/collection/${encodeURIComponent(entry.uuid)}?_locale=${encodeURIComponent(locale)}`,
      {
        headers: {
          Accept: "application/json",
          ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
        },
        next: { revalidate: 60 * 30 },
      },
      8_000,
    );

    if (response.ok) {
      const collection = normalizeNeodbCollection(
        (await response.json()) as NeodbCollection,
        baseUrl,
      );

      return applyCollectionFallbackCover(collection, {
        baseUrl,
        fetchInit: {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
          },
        },
        locale,
      });
    }
  } catch (error) {
    console.error("[neodb] featured collection failed", {
      error,
      uuid: entry.uuid,
    });
  }

  // The collection is missing on this instance (404, error, or timeout). Return
  // null so it is filtered out rather than shown as a broken placeholder card.
  return null;
}

function toHomeCardItem(item: HomeItem) {
  return {
    category: item.category,
    coverUrl: item.coverUrl,
    creator: item.creator,
    detailPath: item.detailPath,
    id: item.id,
    kind: item.kind,
    rating: item.rating,
    title: item.title,
  };
}
