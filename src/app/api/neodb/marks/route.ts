import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ShelfType } from "@/components/mark-badges";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  isNeodbCategory,
  normalizeNeodbItem,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type MarkSchema = {
  comment_text?: string | null;
  created_time?: string | null;
  item: NeodbItem;
  rating_grade?: number | null;
  shelf_type: ShelfType;
};

type PagedMarks = {
  count?: number;
  data?: MarkSchema[];
  pages?: number;
};

const MARKED_PAGE_SIZE = 20;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const shelf = parseShelf(params.get("shelf"));
  const category = params.get("category") || "all";
  const parsedPage = Number(params.get("page") || 1);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;

  if (!shelf || (category !== "all" && !isNeodbCategory(category))) {
    return NextResponse.json({ error: "标记筛选参数无效。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const url = new URL(
      `${session.instance}/api/me/shelf/${encodeURIComponent(shelf)}`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(MARKED_PAGE_SIZE));

    if (category !== "all") {
      url.searchParams.set("category", category);
    }

    const response = await fetchWithTimeout(
      url,
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
      return NextResponse.json(
        { error: "NeoDB 标记读取失败。" },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as PagedMarks;
    const marks = Array.isArray(payload.data) ? payload.data : [];
    const count = Number.isFinite(payload.count) ? Number(payload.count) : marks.length;
    const fallbackPages = count > 0 ? Math.ceil(count / MARKED_PAGE_SIZE) : 0;
    const pages = Number.isFinite(payload.pages)
      ? Math.max(0, Number(payload.pages))
      : fallbackPages;

    return NextResponse.json(
      {
        count,
        items: marks.map((mark) => ({
          item: toMarkedListItem(mark.item, session.instance),
          mark: {
            comment_text: mark.comment_text,
            created_time: mark.created_time,
            item: {
              category: mark.item.category,
              uuid: mark.item.uuid,
            },
            rating_grade: mark.rating_grade,
            shelf_type: mark.shelf_type,
          },
        })),
        pages,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[neodb] marked list fetch failed", error);
    return NextResponse.json(
      { error: "无法读取 NeoDB 标记。" },
      { status: 502 },
    );
  }
}

function toMarkedListItem(item: NeodbItem, baseUrl: string) {
  const normalized = normalizeNeodbItem(item, baseUrl);

  return {
    ...normalized,
    creator: null,
    description: "",
    tags: [],
  };
}

function parseShelf(value: string | null): ShelfType | null {
  return value === "wishlist" ||
    value === "progress" ||
    value === "complete" ||
    value === "dropped"
    ? value
    : null;
}
