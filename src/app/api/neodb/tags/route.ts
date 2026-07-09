import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type TagSchema = {
  title?: string;
  uuid?: string;
};

type PagedTags = {
  data?: TagSchema[];
};

const TAG_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  configureServerFetchProxy();

  try {
    const title = new URL(request.url).searchParams.get("title")?.trim();
    const url = new URL(`${session.instance}/api/me/tag/`);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", title ? "1" : String(TAG_PAGE_SIZE));

    if (title) {
      url.searchParams.set("title", title);
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
      const message = await response.text().catch(() => "");
      throw new Error(message || "无法读取标签。");
    }

    const payload = (await response.json()) as PagedTags;
    const items = (Array.isArray(payload.data) ? payload.data : [])
      .filter((tag) => tag?.uuid && tag?.title)
      .map((tag) => ({
        title: tag.title || "",
        uuid: tag.uuid || "",
      }));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取标签。" },
      { status: 502 },
    );
  }
}
