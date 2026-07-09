import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildCollectionCacheScope,
  clearCollectionPageCache,
} from "@/lib/collection-page-cache";
import { getNeodbBaseUrl } from "@/lib/neodb";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const uuid = url.searchParams.get("uuid")?.trim();

  if (!uuid) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const baseUrl = session?.instance || getNeodbBaseUrl();
  const scope = buildCollectionCacheScope({
    accessToken: session?.accessToken,
    baseUrl,
    uuid,
  });

  clearCollectionPageCache(scope);

  return NextResponse.json({ ok: true });
}
