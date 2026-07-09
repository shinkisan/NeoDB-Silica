import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { mapMastodonEmojis } from "@/lib/mastodon-emoji";

type FollowListType = "followers" | "following";

type MastodonAccount = {
  acct?: string;
  avatar?: string;
  avatar_static?: string;
  display_name?: string;
  emojis?: unknown;
  id?: string;
  note?: string;
  url?: string;
  username?: string;
};

type MastodonRelationship = {
  followed_by?: boolean;
  following?: boolean;
  id?: string;
  requested?: boolean;
};

type FollowActionBody = {
  accountId?: string;
  action?: "follow" | "unfollow";
};

const FOLLOW_LIST_LIMIT = 40;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = normalizeFollowListType(searchParams.get("type"));
  const maxId = searchParams.get("maxId")?.trim();

  if (!type) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const headers = getAuthHeaders(session);
    const ownAccount = await fetchOwnAccount(session, headers);

    if (!ownAccount?.id) {
      return NextResponse.json({ error: "account_not_found" }, { status: 502 });
    }

    const url = new URL(
      `${session.instance}/api/v1/accounts/${encodeURIComponent(ownAccount.id)}/${type}`,
    );
    url.searchParams.set("limit", String(FOLLOW_LIST_LIMIT));
    if (maxId) url.searchParams.set("max_id", maxId);

    const response = await fetchWithTimeout(
      url,
      { cache: "no-store", headers },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json({ error: "follow_list_failed" }, { status: response.status });
    }

    const accounts = ((await response.json()) as MastodonAccount[]).filter(
      (account) => account.id,
    );
    const relationships = await fetchRelationships(
      session,
      headers,
      accounts.map((account) => account.id!).filter(Boolean),
    );
    const relationshipMap = new Map(
      relationships.map((relationship) => [relationship.id, relationship]),
    );

    return NextResponse.json({
      items: accounts.map((account) =>
        toFollowAccount(account, relationshipMap.get(account.id)),
      ),
      nextMaxId:
        accounts.length >= FOLLOW_LIST_LIMIT
          ? getNextMaxId(response.headers.get("link"))
          : null,
    });
  } catch {
    return NextResponse.json({ error: "follow_list_failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FollowActionBody | null;
  const accountId = body?.accountId?.trim();
  const action = body?.action;

  if (!accountId || (action !== "follow" && action !== "unfollow")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/accounts/${encodeURIComponent(accountId)}/${action}`,
      {
        cache: "no-store",
        headers: getAuthHeaders(session),
        method: "POST",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json({ error: "follow_action_failed" }, { status: response.status });
    }

    const relationship = (await response.json()) as MastodonRelationship;
    return NextResponse.json({ relationship });
  } catch {
    return NextResponse.json({ error: "follow_action_failed" }, { status: 502 });
  }
}

async function fetchOwnAccount(
  session: NeodbSessionCookie,
  headers: Record<string, string>,
) {
  const response = await fetchWithTimeout(
    `${session.instance}/api/v1/accounts/verify_credentials`,
    { cache: "no-store", headers },
    8_000,
  );

  if (!response.ok) return null;
  return (await response.json()) as MastodonAccount;
}

async function fetchRelationships(
  session: NeodbSessionCookie,
  headers: Record<string, string>,
  ids: string[],
) {
  if (!ids.length) return [];

  const url = new URL(`${session.instance}/api/v1/accounts/relationships`);
  ids.forEach((id) => url.searchParams.append("id[]", id));

  const response = await fetchWithTimeout(
    url,
    { cache: "no-store", headers },
    8_000,
  ).catch(() => null);

  if (!response?.ok) return [];
  return (await response.json()) as MastodonRelationship[];
}

function toFollowAccount(
  account: MastodonAccount,
  relationship?: MastodonRelationship,
) {
  return {
    acct: account.acct || account.username || "",
    avatar: account.avatar_static || account.avatar || "",
    displayName: account.display_name || account.username || account.acct || "",
    emojis: mapMastodonEmojis(account.emojis) || [],
    followedBy: Boolean(relationship?.followed_by),
    following: Boolean(relationship?.following),
    id: account.id || "",
    requested: Boolean(relationship?.requested),
    url: account.url || "",
    username: account.username || "",
  };
}

function getAuthHeaders(session: NeodbSessionCookie) {
  return {
    Accept: "application/json",
    Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
  };
}

function normalizeFollowListType(value: string | null): FollowListType | null {
  return value === "followers" || value === "following" ? value : null;
}

function getNextMaxId(linkHeader: string | null) {
  if (!linkHeader) return null;

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel="next"/.test(part));

  const match = nextLink?.match(/<([^>]+)>/);
  if (!match) return null;

  try {
    return new URL(match[1]).searchParams.get("max_id");
  } catch {
    return null;
  }
}
