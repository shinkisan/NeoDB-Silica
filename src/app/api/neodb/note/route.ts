import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type NoteSchema = {
  content?: string;
  created_time?: string;
  progress_type?: ProgressType | null;
  progress_value?: string | null;
  title?: string | null;
  uuid?: string;
  visibility?: number;
};

type PagedNotes = {
  count?: number;
  data?: NoteSchema[];
  pages?: number;
};

const NOTE_PAGE_SIZE = 20;

type NoteRequest = {
  content?: string;
  itemUuid?: string;
  noteUuid?: string;
  progressType?: ProgressType | null;
  progressValue?: string | null;
  title?: string;
  visibility?: number;
};

type ProgressType =
  | "chapter"
  | "cycle"
  | "episode"
  | "page"
  | "part"
  | "percentage"
  | "timestamp"
  | "track";

const PROGRESS_TYPES = new Set<ProgressType>([
  "chapter",
  "cycle",
  "episode",
  "page",
  "part",
  "percentage",
  "timestamp",
  "track",
]);

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
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  if (!itemUuid) {
    return NextResponse.json({ error: "缺少条目参数。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const url = new URL(
      `${session.instance}/api/me/note/item/${encodeURIComponent(itemUuid)}/`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(NOTE_PAGE_SIZE));

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
        { error: "NeoDB 笔记请求失败。" },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as PagedNotes;
    const notes = (Array.isArray(payload.data) ? payload.data : [])
      .filter((note) => note.uuid && note.content)
      .map((note) => ({
        content: note.content || "",
        createdAt: note.created_time || "",
        progressType: note.progress_type || null,
        progressValue: note.progress_value || null,
        title: note.title || "",
        url: note.uuid ? `${session.instance}/note/${note.uuid}` : null,
        uuid: note.uuid || "",
        visibility: note.visibility ?? 0,
      }));

    return NextResponse.json({
      count: Math.max(0, payload.count || notes.length),
      notes,
      page,
      pages: Math.max(1, payload.pages || 1),
    });
  } catch (error) {
    console.error("[neodb] note fetch failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 笔记接口。" },
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
  const noteUuid = searchParams.get("noteUuid")?.trim();

  if (!noteUuid) {
    return NextResponse.json({ error: "缺少笔记参数。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/note/${encodeURIComponent(noteUuid)}`,
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
        { error: "NeoDB 笔记删除失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ noteUuid });
  } catch {
    return NextResponse.json(
      { error: "无法连接 NeoDB 笔记接口。" },
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

  const payload = (await request.json().catch(() => null)) as NoteRequest | null;
  const itemUuid = payload?.itemUuid?.trim();
  const noteUuid = payload?.noteUuid?.trim();
  const title = payload?.title?.trim() ?? "";
  const content = payload?.content?.trim();
  const progressType = normalizeProgressType(payload?.progressType);
  const progressValue = payload?.progressValue?.trim() || null;
  const visibility = 2;

  if (!content || (!itemUuid && !noteUuid)) {
    return NextResponse.json({ error: "正文不能为空。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const endpoint = noteUuid
      ? `${session.instance}/api/me/note/${encodeURIComponent(noteUuid)}`
      : `${session.instance}/api/me/note/item/${encodeURIComponent(itemUuid || "")}/`;
    const requestBody: Record<string, unknown> = {
      content,
      post_to_fediverse: false,
      progress_type: progressType,
      progress_value: progressType ? progressValue : null,
      sensitive: false,
      title,
      visibility,
    };

    const response = await fetchWithTimeout(
      endpoint,
      {
        body: JSON.stringify(requestBody),
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: noteUuid ? "PUT" : "POST",
      },
      12_000,
    );

    const responseText = await response.text();
    const upstreamPayload = parseJson(responseText) as NoteSchema | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            getUpstreamError(upstreamPayload) ||
            responseText ||
            "NeoDB 笔记请求失败。",
        },
        { status: response.status },
      );
    }

    const note = upstreamPayload;

    return NextResponse.json({
      content,
      itemUuid,
      noteUuid: note?.uuid || noteUuid || null,
      progressType: note?.progress_type ?? progressType,
      progressValue: note?.progress_value ?? progressValue,
      title: note?.title ?? title,
      visibility,
    });
  } catch (error) {
    console.error("[neodb] note save failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 笔记接口。" },
      { status: 502 },
    );
  }
}

function normalizeProgressType(value: unknown) {
  return typeof value === "string" && PROGRESS_TYPES.has(value as ProgressType)
    ? (value as ProgressType)
    : null;
}

function parseJson(value: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getUpstreamError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.message === "string"
    ? record.message
    : typeof record.error === "string"
      ? record.error
      : typeof record.detail === "string"
        ? record.detail
        : null;
}
