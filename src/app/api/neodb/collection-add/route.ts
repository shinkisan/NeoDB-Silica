import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type NeodbCollection } from "@/lib/neodb";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export async function POST(request: Request) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:collection-add",
    limit: 90,
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

  const body = (await request.json().catch(() => null)) as
    | {
        collectionTitle?: string;
        collectionUuid?: string;
        itemUuid?: string;
      }
    | null;
  const requestedCollectionUuid = body?.collectionUuid?.trim();
  const itemUuid = body?.itemUuid?.trim();

  if (!requestedCollectionUuid || !itemUuid) {
    return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const collectionUuid =
      requestedCollectionUuid === "__new__"
        ? await createCollection(session, body?.collectionTitle)
        : normalizeCollectionUuid(requestedCollectionUuid);

    await addItemToCollection(session, {
      collectionUuid,
      itemUuid,
      note: "",
      retryCount: requestedCollectionUuid === "__new__" ? 3 : 0,
    });

    return NextResponse.json({ collectionUuid, ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加入收藏单失败。" },
      { status: 502 },
    );
  }
}

async function createCollection(
  session: NeodbSessionCookie,
  title?: string,
) {
  const response = await fetchWithTimeout(
    `${session.instance}/api/me/collection/`,
    {
      body: JSON.stringify({
        brief: "",
        query: null,
        title: title?.trim() || "新收藏单",
        visibility: 0,
      }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    8_000,
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || "创建收藏单失败。");
  }

  const collection = (await response.json()) as NeodbCollection;
  const uuid = normalizeCollectionUuid(
    collection.uuid || collection.api_url || collection.url || "",
  );

  if (!uuid) {
    throw new Error("创建收藏单失败。");
  }

  return uuid;
}

async function addItemToCollection(
  session: NeodbSessionCookie,
  {
    collectionUuid,
    itemUuid,
    note,
    retryCount,
  }: {
    collectionUuid: string;
    itemUuid: string;
    note: string;
    retryCount: number;
  },
) {
  const delays = [300, 800, 1500];

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/collection/${encodeURIComponent(collectionUuid)}/item/`,
      {
        body: JSON.stringify({
          item_uuid: itemUuid,
          note,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      8_000,
    );

    if (response.ok) {
      return;
    }

    const message = await response.text().catch(() => "");

    if (response.status !== 404 || attempt >= retryCount) {
      throw new Error(message || "加入收藏单失败。");
    }

    await new Promise((resolve) => setTimeout(resolve, delays[attempt] || 1500));
  }
}

function normalizeCollectionUuid(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/\/collection\/([^/?#]+)/);

  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return trimmed;
}

async function getSession() {
  const cookieStore = await cookies();

  return openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
}
