import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type RouteContext = {
  params: Promise<{
    itemUuid: string;
    uuid: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const limited = checkRateLimit({
    keyPrefix: "neodb:collection-item:delete",
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

  const { itemUuid, uuid } = await context.params;

  if (!itemUuid || !uuid) {
    return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/collection/${encodeURIComponent(uuid)}/item/${encodeURIComponent(itemUuid)}`,
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
      throw new Error(message || "删除条目失败。");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除条目失败。" },
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
