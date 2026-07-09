import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { locales } from "@/i18n/config";
import {
  getNeodbBaseUrl,
  isNeodbCategory,
  NEODB_CATEGORIES,
  normalizeNeodbCollection,
  normalizeNeodbItem,
  type NeodbCollection,
  type HomeItem,
  type NeodbItem,
} from "@/lib/neodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { applyCollectionFallbackCover } from "@/lib/collection-fallback-cover";
import {
  configureServerFetchProxy,
  fetchWithTimeout,
  localeToNeoDBAcceptLanguage,
} from "@/lib/server-fetch";

const DEFAULT_LIMIT = 36;
const TRENDING_CACHE_CONTROL =
  "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "neodb:trending",
    limit: 90,
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
  const category = searchParams.get("category") || "all";
  const limit = Number(searchParams.get("limit") || DEFAULT_LIMIT);
  const shouldRefresh = searchParams.has("refresh");
  const baseUrl = getNeodbBaseUrl();
  configureServerFetchProxy();

  if (category !== "all" && category !== "collection" && !isNeodbCategory(category)) {
    return NextResponse.json(
      { error: "不支持的 NeoDB 分类。" },
      { status: 400 },
    );
  }

  const localeParam = searchParams.get("locale") || "";
  const resolvedLocale = (locales as readonly string[]).includes(localeParam)
    ? localeParam
    : (await cookies()).get("NEXT_LOCALE")?.value || "default";
  const acceptLanguage = localeToNeoDBAcceptLanguage(resolvedLocale);

  const categories = category === "all" ? NEODB_CATEGORIES : [category];

  try {
    const results = await Promise.all(
      categories.map(async (currentCategory) => {
        const response = await fetchWithTimeout(
          `${baseUrl}/api/trending/${currentCategory}/?_locale=${encodeURIComponent(resolvedLocale)}`,
          {
            headers: {
              Accept: "application/json",
              ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
            },
            ...(shouldRefresh
              ? { cache: "no-store" as const }
              : { next: { revalidate: 60 * 30 } }),
          },
          8_000,
        );

        if (!response.ok) {
          throw new Error(
            `NeoDB ${currentCategory} trending failed: ${response.status}`,
          );
        }

        if (currentCategory === "collection") {
          const collections = (await response.json()) as NeodbCollection[];
          const normalizedCollections = collections
            .filter((collection) => collection?.uuid && collection?.url)
            .map((collection) => normalizeNeodbCollection(collection, baseUrl));

          return Promise.all(
            normalizedCollections.map((collection) =>
              applyCollectionFallbackCover(collection, {
                baseUrl,
                fetchInit: {
                  cache: "no-store",
                  headers: {
                    Accept: "application/json",
                    ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
                  },
                },
                locale: resolvedLocale,
              }),
            ),
          );
        }

        const items = (await response.json()) as NeodbItem[];
        return items.map((item) => normalizeNeodbItem(item, baseUrl));
      }),
    );

    const items = interleave(results).slice(0, Number.isFinite(limit) ? limit : DEFAULT_LIMIT);
    const firstCover = items[0]?.coverUrl;
    const responseHeaders = new Headers({
      "Cache-Control": shouldRefresh ? "no-store" : TRENDING_CACHE_CONTROL,
    });

    if (!shouldRefresh) {
      responseHeaders.set("Vercel-CDN-Cache-Control", TRENDING_CACHE_CONTROL);
    }

    if (firstCover) {
      responseHeaders.set("X-Bielu-First-Cover", encodeURIComponent(firstCover));
    }

    return NextResponse.json(
      {
        source: baseUrl,
        category,
        fetchedAt: new Date().toISOString(),
        items: items.map(toHomeCardItem),
      },
      {
        headers: responseHeaders,
      },
    );
  } catch (error) {
    console.error("[neodb] trending failed", error);
    return NextResponse.json(
      { error: "无法获取 NeoDB 热门内容。" },
      { status: 502 },
    );
  }
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

function interleave(groups: HomeItem[][]) {
  const items: HomeItem[] = [];
  const maxLength = Math.max(...groups.map((group) => group.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      const item = group[index];
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}
