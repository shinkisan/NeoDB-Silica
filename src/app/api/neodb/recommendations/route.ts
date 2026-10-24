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
    // NeoDB filters by source before applying the limit, so each group is
    // ranked and capped on its own.
    const [selfResponse, followingResponse] = await Promise.all(
      (["self", "following"] as const).map((source) =>
        fetchWithTimeout(
          `${session.instance}/api/me/recommendations?limit=${encodeURIComponent(limit)}&source=${source}`,
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
              ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
            },
          },
          8_000,
        ),
      ),
    );

    if (selfResponse.status === 401 || followingResponse.status === 401) {
      return NextResponse.json(
        { error: "请先登录 NeoDB。", requiresLogin: true },
        { status: 401 },
      );
    }

    const failed = [selfResponse, followingResponse].find(
      (response) => !response.ok,
    );

    if (failed) {
      return NextResponse.json(
        { error: "NeoDB 为你推荐请求失败。" },
        { status: failed.status },
      );
    }

    const readItems = async (response: Response) => {
      const payload = (await response.json().catch(() => null)) as {
        data?: NeodbItem[];
      } | null;

      return (Array.isArray(payload?.data) ? payload.data : []).filter(
        (item) => Boolean(item?.uuid),
      );
    };
    const [forYou, friends] = await Promise.all([
      readItems(selfResponse),
      readItems(followingResponse),
    ]);

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
