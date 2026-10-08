import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type DismissRequest = {
  itemId?: string;
};

/**
 * Hides a catalog item from the signed-in user's recommendations.
 * Mirrors NeoDB `POST /api/me/recommendations/{item_uuid}/dismiss`.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as DismissRequest | null;
  const itemId = body?.itemId?.trim();

  if (!itemId || !/^[^/\\?#]+$/.test(itemId)) {
    return NextResponse.json({ error: "隐藏条目参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/recommendations/${encodeURIComponent(itemId)}/dismiss`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        method: "POST",
      },
      8_000,
    );

    if (response.status === 401) {
      return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
    }

    if (response.status === 404) {
      return NextResponse.json({ error: "条目不存在。" }, { status: 404 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 隐藏条目请求失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ dismissed: true, itemId });
  } catch (error) {
    console.error("[neodb] dismiss failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 隐藏条目接口。" },
      { status: 502 },
    );
  }
}
