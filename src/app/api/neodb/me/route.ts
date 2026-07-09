import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { mapMastodonEmojis } from "@/lib/mastodon-emoji";

type NeodbUser = {
  avatar: string;
  display_name: string;
  external_accounts?: Array<{ acct?: string; url?: string }>;
  external_acct?: string | null;
  roles: string[];
  url: string;
  username: string;
};

type MastodonAccount = {
  emojis?: unknown;
  followers_count?: number;
  following_count?: number;
  id?: string;
  statuses_count?: number;
};

export async function GET() {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  configureServerFetchProxy();

  try {
    const headers = {
      Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
    };
    const [response, accountResponse] = await Promise.all([
      fetchWithTimeout(
        `${session.instance}/api/me`,
        { cache: "no-store", headers },
        6_000,
      ),
      fetchWithTimeout(
        `${session.instance}/api/v1/accounts/verify_credentials`,
        { cache: "no-store", headers },
        6_000,
      ).catch(() => null),
    ]);

    if (!response.ok) {
      return NextResponse.json({ error: "profile_failed" }, { status: response.status });
    }

    const user = (await response.json()) as NeodbUser;
    const account = accountResponse?.ok
      ? ((await accountResponse.json()) as MastodonAccount)
      : null;

    return NextResponse.json({
      ...user,
      avatar: toAbsoluteUrl(user.avatar, session.instance),
      emojis: mapMastodonEmojis(account?.emojis) || [],
      followers_count: account?.followers_count,
      following_count: account?.following_count,
      id: account?.id,
      statuses_count: account?.statuses_count,
      url: toAbsoluteUrl(user.url, session.instance),
    });
  } catch {
    return NextResponse.json({ error: "profile_fetch_failed" }, { status: 502 });
  }
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (!value || /^https?:\/\//.test(value)) {
    return value;
  }

  return new URL(value, baseUrl).toString();
}
