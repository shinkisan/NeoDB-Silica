import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  normalizeNeodbCollection,
  type NeodbCollection,
} from "@/lib/neodb";
import { applyCollectionFallbackCover } from "@/lib/collection-fallback-cover";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type PagedCollections = {
  count: number;
  data: NeodbCollection[];
  pages: number;
};

export async function GET(request: Request) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:collections:list",
    limit: 60,
    request,
    windowMs: 60 * 1000,
  });

  if (limited.limited) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试。" },
      { status: 429 },
    );
  }

  const session = await getSession();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  configureServerFetchProxy();

  try {
    const url = new URL(`${session.instance}/api/me/collection/`);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "60");

    const response = await fetchWithTimeout(
      url,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      8_000,
    );

    if (!response.ok) {
      throw new Error("收藏单读取失败。");
    }

    const payload = (await response.json()) as PagedCollections;
    const collections = Array.isArray(payload.data) ? payload.data : [];

    const items = await Promise.all(
      collections
        .filter((collection) => collection?.uuid && collection?.url)
        .map((collection) =>
          applyCollectionFallbackCover(
            normalizeNeodbCollection(collection, session.instance),
            {
              baseUrl: session.instance,
              fetchInit: {
                cache: "no-store",
                headers: {
                  Accept: "application/json",
                  Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
                },
              },
            },
          ),
        ),
    );

    return NextResponse.json({
      count: payload.count || collections.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "收藏单读取失败。" },
      { status: 502 },
    );
  }
}

async function getSession() {
  const cookieStore = await cookies();

  return openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
}
