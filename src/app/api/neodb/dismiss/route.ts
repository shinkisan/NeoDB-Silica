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

/** Hides a catalog item from the signed-in user's recommendations. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DismissRequest | null;

  return handleDismiss(request, "POST", body?.itemId);
}

/** Lets a dismissed item be recommended again. */
export async function DELETE(request: Request) {
  // A DELETE body is not always carried through, so the query string is the
  // documented way in for this direction. The body is still accepted.
  const body = (await request.json().catch(() => null)) as DismissRequest | null;
  const itemId =
    new URL(request.url).searchParams.get("itemId") ?? body?.itemId ?? undefined;

  return handleDismiss(request, "DELETE", itemId);
}

/**
 * Both directions of NeoDB's `…/recommendations/{item_uuid}/dismiss`: POST
 * hides the item, DELETE restores it.
 */
async function handleDismiss(
  request: Request,
  method: "POST" | "DELETE",
  rawItemId: string | undefined,
) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const itemId = rawItemId?.trim();

  if (!itemId || !/^[^/\\?#]+$/.test(itemId)) {
    return NextResponse.json(
      { error: method === "POST" ? "隐藏条目参数无效。" : "恢复条目参数无效。" },
      { status: 400 },
    );
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
        method,
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
        {
          error:
            method === "POST"
              ? "NeoDB 隐藏条目请求失败。"
              : "NeoDB 恢复条目请求失败。",
        },
        { status: response.status },
      );
    }

    return NextResponse.json(
      method === "POST" ? { dismissed: true, itemId } : { itemId, restored: true },
    );
  } catch (error) {
    console.error("[neodb] dismiss failed", error);
    return NextResponse.json(
      {
        error:
          method === "POST"
            ? "无法连接 NeoDB 隐藏条目接口。"
            : "无法连接 NeoDB 恢复条目接口。",
      },
      { status: 502 },
    );
  }
}
