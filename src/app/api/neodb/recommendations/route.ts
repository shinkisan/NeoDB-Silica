import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { locales } from "@/i18n/config";
import { resolveRequestLocale } from "@/i18n/resolve-locale";
import { normalizeNeodbItem, type HomeItem, type NeodbItem } from "@/lib/neodb";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  configureServerFetchProxy,
  fetchWithTimeout,
  localeToNeoDBAcceptLanguage,
} from "@/lib/server-fetch";

const DEFAULT_LIMIT = 42;

/**
 * The signed-in visitor's personalised picks, mirroring NeoDB's
 * `GET /api/me/recommendations`. Personal, so never shared through a cache.
 */
export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "neodb:recommendations",
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

  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "请先登录 NeoDB。", requiresLogin: true },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") || DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT;

  const localeParam = searchParams.get("locale") || "";
  const resolvedLocale = (locales as readonly string[]).includes(localeParam)
    ? localeParam
    : await resolveRequestLocale();
  const acceptLanguage = localeToNeoDBAcceptLanguage(resolvedLocale);

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/recommendations?limit=${encodeURIComponent(limit)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
        },
      },
      8_000,
    );

    if (response.status === 401) {
      return NextResponse.json(
        { error: "请先登录 NeoDB。", requiresLogin: true },
        { status: 401 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 为你推荐请求失败。" },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as {
      data?: NeodbItem[];
      seeds?: Record<string, string[]> | null;
    } | null;
    const seeds = payload?.seeds ?? null;
    const rawItems = (Array.isArray(payload?.data) ? payload.data : []).filter(
      (item) => Boolean(item?.uuid),
    );
    // A seeds entry means the item was picked for the visitor's own marks;
    // items without one came from the people they follow. The blend
    // interleaves the two sources by rank, so each group keeps its own
    // ranking once split.
    const forYou = rawItems.filter((item) => Boolean(seeds?.[item.uuid]));
    const friends = rawItems.filter((item) => !seeds?.[item.uuid]);

    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        friendItems: friends.map((item) =>
          toHomeCardItem(normalizeNeodbItem(item, session.instance)),
        ),
        items: forYou.map((item) =>
          toHomeCardItem(normalizeNeodbItem(item, session.instance)),
        ),
        source: session.instance,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[neodb] recommendations failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 为你推荐接口。" },
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
