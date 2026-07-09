import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type DeleteRequest = {
  postId?: string;
};

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as DeleteRequest | null;
  const postId = body?.postId?.trim();

  if (!postId) {
    return NextResponse.json({ error: "删除参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/statuses/${encodeURIComponent(postId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        method: "DELETE",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 删除请求失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true, postId });
  } catch (error) {
    console.error("[neodb] post delete failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 删除接口。" },
      { status: 502 },
    );
  }
}
