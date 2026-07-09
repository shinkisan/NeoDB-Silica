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

type RouteContext = {
  params: Promise<{
    uuid: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:collections:update",
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

  const { uuid } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        brief?: string;
        title?: string;
      }
    | null;
  const requestedTitle = body?.title?.trim();
  const hasBrief = typeof body?.brief === "string";

  if (!uuid || (!requestedTitle && !hasBrief)) {
    return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const collection = await fetchCollection(session, uuid);
    const title = requestedTitle || collection.title;

    if (!title?.trim()) {
      return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
    }

    const response = await fetchWithTimeout(
      `${session.instance}/api/me/collection/${encodeURIComponent(uuid)}`,
      {
        body: JSON.stringify({
          brief: hasBrief ? body.brief || "" : collection.brief || "",
          query: collection.query || null,
          title,
          visibility: typeof collection.visibility === "number" ? collection.visibility : 0,
        }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
      8_000,
    );

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || "重命名收藏单失败。");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "重命名收藏单失败。",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:collections:delete",
    limit: 40,
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

  const { uuid } = await context.params;

  if (!uuid) {
    return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/collection/${encodeURIComponent(uuid)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        method: "DELETE",
      },
      8_000,
    );

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || "删除收藏单失败。");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除收藏单失败。" },
      { status: 502 },
    );
  }
}

async function fetchCollection(session: NeodbSessionCookie, uuid: string) {
  const response = await fetchWithTimeout(
    `${session.instance}/api/me/collection/${encodeURIComponent(uuid)}`,
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
    const message = await response.text().catch(() => "");
    throw new Error(message || "无法读取收藏单。");
  }

  return (await response.json()) as NeodbCollection & {
    visibility?: number;
  };
}

async function getSession() {
  const cookieStore = await cookies();

  return openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
}
