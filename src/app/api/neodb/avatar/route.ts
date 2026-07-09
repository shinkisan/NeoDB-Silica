import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { isPubliclyRoutableUrl } from "@/lib/ssrf-guard";

type NeodbUser = {
  avatar: string;
};

// A NeoDB account's avatar can legitimately be hosted on any federated
// instance, so (unlike /api/image/cover) this route can't use a fixed
// hostname allowlist. isPubliclyRoutableUrl() blocks loopback/private/
// link-local targets (including the cloud metadata IP) instead, and the
// content-type/size checks below stop it being used as a generic file-read
// proxy for non-image internal responses.
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedUrl = searchParams.get("url")?.trim();

  if (!requestedUrl || !/^https?:\/\//.test(requestedUrl)) {
    return NextResponse.json({ error: "invalid_avatar_url" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const profileResponse = await fetchWithTimeout(
      `${session.instance}/api/me`,
      {
        cache: "no-store",
        headers: {
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      6_000,
    );

    if (!profileResponse.ok) {
      return NextResponse.json(
        { error: "profile_failed" },
        { status: profileResponse.status },
      );
    }

    const user = (await profileResponse.json()) as NeodbUser;
    const avatarUrl = toAbsoluteUrl(user.avatar, session.instance);

    if (avatarUrl !== requestedUrl) {
      return NextResponse.json({ error: "avatar_url_mismatch" }, { status: 403 });
    }

    if (!(await isPubliclyRoutableUrl(avatarUrl))) {
      return NextResponse.json({ error: "avatar_url_not_allowed" }, { status: 400 });
    }

    const avatarResponse = await fetchWithTimeout(
      avatarUrl,
      {
        headers: { Accept: "image/*" },
        redirect: "manual",
      },
      8_000,
    );

    if (!avatarResponse.ok) {
      return NextResponse.json(
        { error: "avatar_fetch_failed" },
        { status: avatarResponse.status },
      );
    }

    const contentType = avatarResponse.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "avatar_not_an_image" }, { status: 502 });
    }

    const contentLength = Number(avatarResponse.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "avatar_too_large" }, { status: 502 });
    }

    const body = await avatarResponse.arrayBuffer();

    if (body.byteLength > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "avatar_too_large" }, { status: 502 });
    }

    return new Response(body, {
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Type": contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "avatar_fetch_failed" }, { status: 502 });
  }
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (!value || /^https?:\/\//.test(value)) {
    return value;
  }

  return new URL(value, baseUrl).toString();
}
