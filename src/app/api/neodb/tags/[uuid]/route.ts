import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type TagSchema = {
  title?: string;
  visibility?: number;
};

type RouteContext = {
  params: Promise<{
    uuid: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:tags:update",
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
        title?: string;
        visibility?: number;
      }
    | null;
  const title = body?.title?.trim();

  if (!uuid || !title) {
    return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const existingTag =
      typeof body?.visibility === "number" ? null : await fetchTag(session, uuid);
    const visibility =
      typeof body?.visibility === "number"
        ? body.visibility
        : typeof existingTag?.visibility === "number"
          ? existingTag.visibility
          : 0;
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/tag/${encodeURIComponent(uuid)}`,
      {
        body: JSON.stringify({ title, visibility }),
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
      throw new Error(message || "重命名标签失败。");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重命名标签失败。" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:tags:delete",
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
      `${session.instance}/api/me/tag/${encodeURIComponent(uuid)}`,
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
      throw new Error(message || "删除标签失败。");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除标签失败。" },
      { status: 502 },
    );
  }
}

async function fetchTag(session: NeodbSessionCookie, uuid: string) {
  const response = await fetchWithTimeout(
    `${session.instance}/api/me/tag/${encodeURIComponent(uuid)}`,
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
    throw new Error(message || "无法读取标签。");
  }

  return (await response.json()) as TagSchema;
}

async function getSession() {
  const cookieStore = await cookies();

  return openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
}
