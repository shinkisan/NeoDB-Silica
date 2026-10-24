import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { locales } from "@/i18n/config";
import { resolveRequestLocale } from "@/i18n/resolve-locale";
import { normalizeNeodbItem, type NeodbItem } from "@/lib/neodb";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  configureServerFetchProxy,
  fetchWithTimeout,
  localeToNeoDBAcceptLanguage,
} from "@/lib/server-fetch";

const PAGE_SIZE = 20;

/**
 * The items the signed-in visitor hid from recommendations, mirroring NeoDB's
 * `GET /api/me/recommendations/dismissed`. Personal, so never cached.
 */
export async function GET(request: Request) {
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
  const requestedPage = Number(searchParams.get("page") || 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const localeParam = searchParams.get("locale") || "";
  const resolvedLocale = (locales as readonly string[]).includes(localeParam)
    ? localeParam
    : await resolveRequestLocale();
  const acceptLanguage = localeToNeoDBAcceptLanguage(resolvedLocale);

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/recommendations/dismissed?page=${page}&page_size=${PAGE_SIZE}`,
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
        { error: "NeoDB 屏蔽条目列表请求失败。" },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as {
      count?: number;
      data?: { created_time?: string; item?: NeodbItem }[];
      pages?: number;
    } | null;
    const items = (Array.isArray(payload?.data) ? payload.data : [])
      .filter((entry) => Boolean(entry?.item?.uuid))
      .map((entry) => {
        const item = normalizeNeodbItem(entry.item as NeodbItem, session.instance);

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
      });

    return NextResponse.json(
      {
        count: payload?.count ?? items.length,
        items,
        page,
        pages: Math.max(payload?.pages ?? 1, 1),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[neodb] dismissed list failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 屏蔽条目接口。" },
      { status: 502 },
    );
  }
}
