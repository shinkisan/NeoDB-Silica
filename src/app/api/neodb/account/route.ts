import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { mapMastodonEmojis } from "@/lib/mastodon-emoji";

type MastodonAccount = {
  acct?: string;
  avatar?: string;
  avatar_static?: string;
  display_name?: string;
  emojis?: unknown;
  fields?: Array<{ name?: string; value?: string; verified_at?: string | null }>;
  id?: string;
  note?: string;
  url?: string;
  username?: string;
};

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

const KNOWN_MASTODON_HOSTS = new Set([
  "mastodon.social",
  "mastodon.online",
  "mas.to",
  "mstdn.social",
  "fosstodon.org",
  "hachyderm.io",
  "mastodon.world",
  "universeodon.com",
  "mstdn.jp",
  "pawoo.net",
  "mstdn.party",
]);

function classifyHost(hostname: string): "neodb" | "mastodon" | "other" {
  const host = hostname.toLowerCase();
  if (host.includes("neodb")) return "neodb";
  if (KNOWN_MASTODON_HOSTS.has(host)) return "mastodon";
  return "other";
}

function extractHref(html: string) {
  const match = /href="([^"]+)"/.exec(html);
  return match?.[1]?.replace(/&amp;/g, "&") || null;
}

function buildProfileLinks(account: MastodonAccount) {
  const seen = new Set<string>();
  const links: Array<{ href: string; hostname: string; kind: string }> = [];

  function addLink(rawHref: string | null | undefined) {
    if (!rawHref) return;

    try {
      const url = new URL(rawHref);
      const href = url.toString();
      if (seen.has(href)) return;

      seen.add(href);
      links.push({ href, hostname: url.hostname, kind: classifyHost(url.hostname) });
    } catch {
      // not an absolute URL, skip
    }
  }

  addLink(account.url);
  for (const field of account.fields || []) {
    addLink(extractHref(field.value || ""));
  }

  return links;
}

type MastodonRelationship = {
  blocking?: boolean;
  followed_by?: boolean;
  following?: boolean;
  id?: string;
  requested?: boolean;
};

type AccountActionBody = {
  accountId?: string;
  action?: "block" | "unblock";
};

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const headers = {
    Accept: "application/json",
    Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
  };

  configureServerFetchProxy();

  try {
    const [response, selfResponse] = await Promise.all([
      fetchWithTimeout(
        `${session.instance}/api/v1/accounts/${encodeURIComponent(id)}`,
        { cache: "no-store", headers },
        8_000,
      ),
      fetchWithTimeout(
        `${session.instance}/api/v1/accounts/verify_credentials`,
        { cache: "no-store", headers },
        8_000,
      ).catch(() => null),
    ]);

    if (!response.ok) {
      return NextResponse.json({ error: "account_fetch_failed" }, { status: response.status });
    }

    const account = (await response.json()) as MastodonAccount;

    if (!account.id) {
      return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    }

    const selfAccount = selfResponse?.ok
      ? ((await selfResponse.json()) as MastodonAccount)
      : null;
    const isSelf = Boolean(selfAccount?.id && selfAccount.id === account.id);

    let blocking = false;
    let followedBy = false;
    let following = false;
    let requested = false;

    if (!isSelf) {
      const relationship = await fetchRelationship(session, headers, account.id);
      blocking = Boolean(relationship?.blocking);
      followedBy = Boolean(relationship?.followed_by);
      following = Boolean(relationship?.following);
      requested = Boolean(relationship?.requested);
    }

    return NextResponse.json({
      acct: account.acct || account.username || "",
      avatar: account.avatar_static || account.avatar || "",
      bio: stripHtml(account.note || ""),
      blocking,
      displayName: account.display_name || account.username || account.acct || "",
      emojis: mapMastodonEmojis(account.emojis) || [],
      followedBy,
      following,
      id: account.id,
      isSelf,
      links: buildProfileLinks(account),
      requested,
      url: account.url || "",
      username: account.username || "",
    });
  } catch {
    return NextResponse.json({ error: "account_fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AccountActionBody | null;
  const accountId = body?.accountId?.trim();
  const action = body?.action;

  if (!accountId || (action !== "block" && action !== "unblock")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/accounts/${encodeURIComponent(accountId)}/${action}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        method: "POST",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json({ error: "block_action_failed" }, { status: response.status });
    }

    const relationship = (await response.json()) as MastodonRelationship;
    return NextResponse.json({ relationship });
  } catch {
    return NextResponse.json({ error: "block_action_failed" }, { status: 502 });
  }
}

async function fetchRelationship(
  session: NeodbSessionCookie,
  headers: Record<string, string>,
  accountId: string,
) {
  const url = new URL(`${session.instance}/api/v1/accounts/relationships`);
  url.searchParams.set("id[]", accountId);

  const response = await fetchWithTimeout(
    url,
    { cache: "no-store", headers },
    8_000,
  ).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const relationships = (await response.json()) as MastodonRelationship[];
  return relationships.find((relationship) => relationship.id === accountId) || null;
}
