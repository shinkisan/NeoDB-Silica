import { cookies } from "next/headers";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { getCommunityCommentPage, getCommunityOwnEntries } from "@/lib/community";
import { getLocale } from "@/i18n/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const itemUuid = url.searchParams.get("itemUuid")?.trim();
  const category = url.searchParams.get("category")?.trim() || "";
  const type = url.searchParams.get("type")?.trim() || "comment";
  const pageParam = Number(url.searchParams.get("page") || "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  if (!itemUuid || !category) {
    return Response.json({ error: "缺少条目参数。" }, { status: 400 });
  }

  if (type !== "comment" && type !== "review" && type !== "own") {
    return Response.json({ error: "参数无效。" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const locale = await getLocale();

  if (type === "own") {
    return Response.json(
      await getCommunityOwnEntries({ category, itemUuid, locale, session }),
    );
  }

  return Response.json(
    await getCommunityCommentPage({ category, itemUuid, locale, page, session, type }),
  );
}
