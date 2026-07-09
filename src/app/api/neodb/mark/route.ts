import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import {
  emptyMarkSnapshot,
  fetchShelfMarkResponse,
  fetchShelfMarkSnapshot,
  NeodbMarkFetchError,
  shelfTypes,
  type ShelfType,
} from "@/lib/neodb-mark";
import { isNeodbVisibility } from "@/lib/neodb-visibility";

type MarkRequest = {
  commentText?: string;
  itemUuid?: string;
  markedDate?: string;
  postToFediverse?: boolean;
  ratingGrade?: number;
  shelfType?: ShelfType;
  tags?: string[];
  visibility?: number;
};

type ShelfMarkResponse = {
  comment_text?: string | null;
  created_time?: string | null;
  rating_grade?: number | null;
  shelf_type?: ShelfType | null;
  tags?: string[] | null;
  visibility?: number | null;
};

export async function GET(request: Request) {
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
    return NextResponse.json({ error: "标记参数无效。" }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchShelfMarkSnapshot(session, itemUuid));
  } catch (error) {
    if (error instanceof NeodbMarkFetchError) {
      return NextResponse.json(
        { error: "NeoDB 标记读取失败。" },
        { status: error.status },
      );
    }

    console.error("[neodb] mark fetch failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 标记接口。" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as MarkRequest | null;
  const itemUuid = body?.itemUuid?.trim();

  if (!itemUuid) {
    return NextResponse.json({ error: "标记参数无效。" }, { status: 400 });
  }

  if (body?.shelfType && !shelfTypes.includes(body.shelfType)) {
    return NextResponse.json({ error: "标记参数无效。" }, { status: 400 });
  }

  if (
    body?.ratingGrade !== undefined &&
    (!Number.isInteger(Number(body.ratingGrade)) ||
      Number(body.ratingGrade) < 0 ||
      Number(body.ratingGrade) > 10)
  ) {
    return NextResponse.json({ error: "评分参数无效。" }, { status: 400 });
  }

  if (
    body?.visibility !== undefined &&
    !isNeodbVisibility(Number(body.visibility))
  ) {
    return NextResponse.json({ error: "可见性参数无效。" }, { status: 400 });
  }

  if (
    body?.tags !== undefined &&
    !(
      Array.isArray(body.tags) &&
      body.tags.every((tag) => typeof tag === "string")
    )
  ) {
    return NextResponse.json({ error: "标签参数无效。" }, { status: 400 });
  }

  if (
    body?.markedDate !== undefined &&
    body.markedDate !== "" &&
    !isDateInputValue(body.markedDate)
  ) {
    return NextResponse.json({ error: "标记时间参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const existingResponse = await fetchShelfMarkResponse(session, itemUuid);
    let existingMark: ShelfMarkResponse | null = null;

    if (existingResponse.status !== 404) {
      if (!existingResponse.ok) {
        return NextResponse.json(
          { error: "NeoDB 标记读取失败。" },
          { status: existingResponse.status },
        );
      }

      existingMark = (await existingResponse.json()) as ShelfMarkResponse;
    }

    const shelfType = body?.shelfType || existingMark?.shelf_type;

    if (!shelfType) {
      return NextResponse.json(
        { error: "请先标记条目。" },
        { status: 409 },
      );
    }

    const ratingGrade =
      body?.ratingGrade !== undefined
        ? Number(body.ratingGrade)
        : existingMark?.rating_grade || 0;
    const commentText = body?.commentText ?? existingMark?.comment_text ?? "";
    const shouldPostToFediverse =
      body?.postToFediverse === true && Boolean(body?.commentText?.trim());
    const visibility =
      body?.visibility !== undefined
        ? Number(body.visibility)
        : existingMark?.visibility ?? 0;
    const tags =
      body?.tags !== undefined
        ? normalizeTags(body.tags)
        : Array.isArray(existingMark?.tags)
          ? normalizeTags(existingMark.tags)
          : [];
    const isShelfTypeChange =
      Boolean(body?.shelfType) &&
      Boolean(existingMark?.shelf_type) &&
      body?.shelfType !== existingMark?.shelf_type;
    const createdTime =
      body?.markedDate !== undefined
        ? dateInputToCreatedTime(body.markedDate)
        : isShelfTypeChange
          ? new Date().toISOString()
          : existingMark?.created_time || undefined;

    const response = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
      {
        body: JSON.stringify({
          shelf_type: shelfType,
          visibility,
          comment_text: commentText,
          rating_grade: ratingGrade,
          tags,
          ...(createdTime ? { created_time: createdTime } : {}),
          ...(body?.postToFediverse !== undefined
            ? { post_to_fediverse: shouldPostToFediverse }
            : {}),
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
        { error: "NeoDB 标记请求失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json(await fetchShelfMarkSnapshot(session, itemUuid));
  } catch (error) {
    console.error("[neodb] mark save failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 标记接口。" },
      { status: 502 },
    );
  }
}

function isDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateInputToCreatedTime(value: string) {
  if (!value) {
    return undefined;
  }

  return `${value}T12:00:00.000Z`;
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = tag.trim().replace(/^#+/, "");
    const key = value.toLocaleLowerCase();

    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
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
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
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
        { error: "NeoDB 标记删除失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json(emptyMarkSnapshot(itemUuid));
  } catch {
    return NextResponse.json(
      { error: "无法连接 NeoDB 标记接口。" },
      { status: 502 },
    );
  }
}
