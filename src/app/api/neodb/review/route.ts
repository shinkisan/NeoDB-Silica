import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { getNeodbBaseUrl } from "@/lib/neodb";
import { normalizeNeodbVisibility } from "@/lib/neodb-visibility";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type ReviewRequest = {
  body?: string;
  itemUuid?: string;
  postToFediverse?: boolean;
  title?: string;
  visibility?: number;
};

type ReviewSchema = {
  body?: string;
  html_content?: string;
  title?: string;
  url?: string;
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
  const apiUrl = searchParams.get("apiUrl")?.trim();
  const itemUuid = searchParams.get("itemUuid")?.trim();
  const reviewUuid = searchParams.get("reviewUuid")?.trim();
  const isSummary = searchParams.get("summary") === "1";

  if (!apiUrl && !itemUuid && !reviewUuid) {
    return NextResponse.json({ error: "缺少条目参数。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const endpoint = getReviewEndpoint({
      apiUrl,
      baseUrl: session.instance || getNeodbBaseUrl(),
      itemUuid,
      reviewUuid,
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: "长评地址无效。" },
        { status: 400 },
      );
    }

    const response = await fetchWithTimeout(
      endpoint,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      8_000,
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "暂无长评。" }, { status: 404 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 长评请求失败。" },
        { status: response.status },
      );
    }

    const review = (await response.json()) as ReviewSchema;

    if (isSummary) {
      return NextResponse.json({
        title: review.title || "",
        url: review.url || null,
      });
    }

    return NextResponse.json({
      body: review.body || stripHtml(review.html_content || ""),
      title: review.title || "长评",
      url: review.url || null,
      visibility: review.visibility ?? 0,
    });
  } catch (error) {
    console.error("[neodb] review fetch failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 长评接口。" },
      { status: 502 },
    );
  }
}

function getReviewEndpoint({
  apiUrl,
  baseUrl,
  itemUuid,
  reviewUuid,
}: {
  apiUrl?: string | null;
  baseUrl: string;
  itemUuid?: string | null;
  reviewUuid?: string | null;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (itemUuid) {
    return `${normalizedBaseUrl}/api/me/review/item/${encodeURIComponent(itemUuid)}`;
  }

  if (apiUrl) {
    const endpoint = new URL(apiUrl, normalizedBaseUrl);
    const baseOrigin = new URL(normalizedBaseUrl).origin;

    if (endpoint.origin !== baseOrigin) {
      return null;
    }

    return endpoint.toString();
  }

  return `${normalizedBaseUrl}/api/review/${encodeURIComponent(reviewUuid || "")}`;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as ReviewRequest | null;
  const itemUuid = payload?.itemUuid?.trim();
  const title = payload?.title?.trim();
  const body = payload?.body?.trim();
  const visibility = normalizeNeodbVisibility(payload?.visibility);

  if (!itemUuid || !title || !body) {
    return NextResponse.json({ error: "标题和正文不能为空。" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/review/item/${encodeURIComponent(itemUuid)}`,
      {
        body: JSON.stringify({
          body,
          post_to_fediverse: payload?.postToFediverse === true,
          title,
          visibility,
        }),
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      12_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 长评请求失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ itemUuid, title });
  } catch (error) {
    console.error("[neodb] review save failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 长评接口。" },
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
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/review/item/${encodeURIComponent(itemUuid)}`,
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
        { error: "NeoDB 长评删除失败。" },
        { status: response.status },
      );
    }

    return NextResponse.json({ itemUuid });
  } catch {
    return NextResponse.json(
      { error: "无法连接 NeoDB 长评接口。" },
      { status: 502 },
    );
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
