import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type FavouriteRequest = {
  favourite?: boolean;
  postId?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FavouriteRequest | null;
  const postId = body?.postId?.trim();

  if (!postId) {
    return NextResponse.json({ error: "点赞参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const action = body?.favourite === false ? "unfavourite" : "favourite";
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/statuses/${encodeURIComponent(postId)}/${action}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        method: "POST",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 点赞请求失败。" },
        { status: response.status },
      );
    }

    const post = (await response.json()) as {
      favorited?: boolean;
      favourited?: boolean;
      favourites_count?: number;
      id?: string;
    };
    const resolvedFavourited =
      post.favourited ?? post.favorited ?? body?.favourite !== false;

    return NextResponse.json({
      favourited: resolvedFavourited,
      favouritesCount:
        typeof post.favourites_count === "number" ? post.favourites_count : null,
      postId: post.id || postId,
    });
  } catch (error) {
    console.error("[neodb] favourite failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 点赞接口。" },
      { status: 502 },
    );
  }
}
