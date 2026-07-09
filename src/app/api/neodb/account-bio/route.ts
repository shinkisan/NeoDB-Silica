import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type UpdateBioRequest = {
  bio?: string;
};

type MastodonAccount = {
  note?: string;
};

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "请先登录 NeoDB。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as UpdateBioRequest | null;
  const bio = body?.bio ?? "";

  configureServerFetchProxy();

  try {
    const form = new URLSearchParams({ note: bio });
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/accounts/update_credentials`,
      {
        body: form,
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "PATCH",
      },
      10_000,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "NeoDB 简介更新请求失败。" },
        { status: response.status },
      );
    }

    const account = (await response.json()) as MastodonAccount;
    return NextResponse.json({ bio: stripHtml(account.note || "") });
  } catch (error) {
    console.error("[neodb] account bio update failed", error);
    return NextResponse.json(
      { error: "无法连接 NeoDB 简介接口。" },
      { status: 502 },
    );
  }
}

function stripHtml(html: string) {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeHtmlEntities(text);
}

function decodeHtmlEntities(value: string) {
  let decoded = value;

  for (let index = 0; index < 8; index += 1) {
    const next = decoded
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, entity: string) =>
        decodeCodePoint(entity, 16),
      )
      .replace(/&#(\d+);/g, (_, entity: string) =>
        decodeCodePoint(entity, 10),
      );

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function decodeCodePoint(value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);

  try {
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  } catch {
    return "";
  }
}
