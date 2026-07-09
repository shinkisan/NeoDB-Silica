import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type CommentRequest = {
  content?: string;
  itemUuid?: string;
};

type ShelfMark = {
  comment_text?: string | null;
  rating_grade?: number | null;
  shelf_type?: "wishlist" | "progress" | "complete" | "dropped" | null;
  tags?: string[] | null;
  visibility?: number | null;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CommentRequest | null;
  const itemUuid = body?.itemUuid?.trim();
  const content = body?.content?.trim();

  if (!itemUuid || !content) {
    return NextResponse.json({ error: "评论内容不能为空。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const markResponse = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      8_000,
    );

    if (markResponse.status === 404) {
      return NextResponse.json(
        { error: "请先标记条目。" },
        { status: 409 },
      );
    }

    if (!markResponse.ok) {
      return NextResponse.json(
        { error: "NeoDB 标记读取失败。" },
        { status: markResponse.status },
      );
    }

    const mark = (await markResponse.json()) as ShelfMark;

    if (!mark.shelf_type) {
      return NextResponse.json(
        { error: "请先标记条目。" },
        { status: 409 },
      );
    }

    const response = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
      {
        body: JSON.stringify({
          shelf_type: mark.shelf_type,
          visibility: mark.visibility ?? 0,
          comment_text: content,
          rating_grade: mark.rating_grade || 0,
          tags: Array.isArray(mark.tags) ? mark.tags : [],
          post_to_fediverse: true,
        }),
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      10_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 短评请求失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ commentText: content, itemUuid });
  } catch (error) {
    console.error("[neodb] comment save failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 短评接口。" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemUuid = searchParams.get("itemUuid")?.trim();

  if (!itemUuid) {
    return NextResponse.json({ error: "缺少条目参数。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const markResponse = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      8_000,
    );

    if (!markResponse.ok) {
      return NextResponse.json(
        { error: "NeoDB 标记读取失败。" },
        { status: markResponse.status },
      );
    }

    const mark = (await markResponse.json()) as ShelfMark;

    const response = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
      {
        body: JSON.stringify({
          shelf_type: mark.shelf_type,
          visibility: mark.visibility ?? 0,
          comment_text: "",
          rating_grade: mark.rating_grade || 0,
          tags: Array.isArray(mark.tags) ? mark.tags : [],
          post_to_fediverse: true,
        }),
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      10_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 短评删除失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ itemUuid });
  } catch {
    return NextResponse.json(
      { error: "无法连接 NeoDB 短评接口。" },
      { status: 502 },
    );
  }
}
