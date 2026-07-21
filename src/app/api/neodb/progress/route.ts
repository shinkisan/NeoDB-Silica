import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  isValidReadingProgressValue,
  normalizeReadingProgress,
  readingProgressTypes,
  type ReadingProgress,
  type ReadingProgressType,
} from "@/lib/reading-progress";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

const MAX_BATCH_SIZE = 20;
const BATCH_CONCURRENCY = 5;

type ProgressRequest = {
  itemUuid?: string;
  type?: ReadingProgressType;
  value?: string;
};

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const itemUuid = searchParams.get("itemUuid")?.trim();
  const itemUuids = parseItemUuids(searchParams.get("itemUuids"));

  if (itemUuid) {
    return proxySingleProgress(session, itemUuid);
  }

  if (!itemUuids.length || itemUuids.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: "阅读进度参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();
  const items: Record<string, ReadingProgress | null> = {};

  for (let index = 0; index < itemUuids.length; index += BATCH_CONCURRENCY) {
    const chunk = itemUuids.slice(index, index + BATCH_CONCURRENCY);

    await Promise.all(
      chunk.map(async (uuid) => {
        try {
          const response = await fetchProgress(session, uuid);
          items[uuid] = response.ok
            ? normalizeReadingProgress(await response.json())
            : null;
        } catch {
          items[uuid] = null;
        }
      }),
    );
  }

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ProgressRequest | null;
  const itemUuid = body?.itemUuid?.trim();
  const type = body?.type;
  const value = body?.value?.trim() || "";

  if (
    !itemUuid ||
    !type ||
    !readingProgressTypes.includes(type) ||
    !isValidReadingProgressValue(type, value)
  ) {
    return NextResponse.json({ error: "阅读进度参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      getProgressUrl(session, itemUuid),
      {
        body: JSON.stringify({ type, value }),
        headers: getHeaders(session, true),
        method: "POST",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 阅读进度保存失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json(normalizeReadingProgress(await response.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[neodb] reading progress save failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 阅读进度接口。" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const itemUuid = new URL(request.url).searchParams.get("itemUuid")?.trim();

  if (!itemUuid) {
    return NextResponse.json({ error: "阅读进度参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      getProgressUrl(session, itemUuid),
      {
        headers: getHeaders(session),
        method: "DELETE",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 阅读进度清除失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json(null, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[neodb] reading progress clear failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 阅读进度接口。" },
      { status: 502 },
    );
  }
}

async function proxySingleProgress(
  session: NeodbSessionCookie,
  itemUuid: string,
) {
  configureServerFetchProxy();

  try {
    const response = await fetchProgress(session, itemUuid);

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 阅读进度读取失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json(normalizeReadingProgress(await response.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[neodb] reading progress fetch failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 阅读进度接口。" },
      { status: 502 },
    );
  }
}

async function getSession() {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  return session?.accessToken ? session : null;
}

function fetchProgress(session: NeodbSessionCookie, itemUuid: string) {
  return fetchWithTimeout(
    getProgressUrl(session, itemUuid),
    {
      cache: "no-store",
      headers: getHeaders(session),
    },
    5_000,
  );
}

function getProgressUrl(session: NeodbSessionCookie, itemUuid: string) {
  return `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}/progress`;
}

function getHeaders(session: NeodbSessionCookie, includeContentType = false) {
  return {
    Accept: "application/json",
    Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
  };
}

function parseItemUuids(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(value.split(",").map((uuid) => uuid.trim()).filter(Boolean)),
  );
}
