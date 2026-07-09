import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { getNeodbBaseUrl } from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { mapMastodonMentions } from "@/lib/mastodon-emoji";
import { isRemoteAccount } from "@/lib/account-link";
import { toFullAccountHandle } from "@/lib/account-handle";

type MastodonAccount = {
  acct?: string;
  id?: string;
  avatar?: string;
  display_name?: string;
  url?: string;
  username?: string;
};

type MastodonStatus = {
  account?: MastodonAccount;
  content?: string;
  created_at?: string;
  ext_neodb?: {
    relatedWith?: unknown[] | Record<string, unknown> | null;
  } | null;
  favourited?: boolean;
  favorited?: boolean;
  favourites_count?: number;
  id?: string;
  in_reply_to_id?: string | null;
  mentions?: unknown;
};

type MastodonContext = {
  descendants?: MastodonStatus[];
};

type ReplyRequest = {
  content?: string;
  postId?: string;
};

export async function GET(request: Request) {
  const postId = new URL(request.url).searchParams.get("postId")?.trim();

  if (!postId) {
    return NextResponse.json({ error: "invalid_post" }, { status: 400 });
  }

  const session = await getSession();
  const instance = session?.instance || getNeodbBaseUrl();
  configureServerFetchProxy();

  try {
    const headers = getHeaders(session);
    const [response, accountResponse] = await Promise.all([
      fetchWithTimeout(
        `${instance}/api/v1/statuses/${encodeURIComponent(postId)}/context`,
        {
          cache: "no-store",
          headers,
        },
        8_000,
      ),
      session?.accessToken
        ? fetchWithTimeout(
            `${instance}/api/v1/accounts/verify_credentials`,
            {
              cache: "no-store",
              headers,
            },
            8_000,
          )
        : Promise.resolve(null),
    ]);

    if (!response.ok) {
      return NextResponse.json({ error: "replies_failed" }, { status: response.status });
    }

    const context = (await response.json()) as MastodonContext;
    const account =
      accountResponse?.ok
        ? ((await accountResponse.json()) as MastodonAccount)
        : null;
    const instanceHost = getInstanceHost(instance);
    return NextResponse.json({
      replies: (context.descendants || []).map((reply) =>
        toReply(reply, account?.id, instanceHost),
      ),
    });
  } catch (error) {
    console.error("[neodb] replies fetch failed", error);
    return NextResponse.json({ error: "replies_unavailable" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ReplyRequest | null;
  const content = body?.content?.trim();
  const postId = body?.postId?.trim();

  if (!postId || !content) {
    return NextResponse.json({ error: "invalid_reply" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const headers = getHeaders(session);
    const form = new URLSearchParams({
      in_reply_to_id: postId,
      status: content,
      visibility: "public",
    });
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/statuses`,
      {
        body: form,
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
      15_000,
    );

    if (!response.ok) {
      return NextResponse.json({ error: "reply_failed" }, { status: response.status });
    }

    const reply = (await response.json()) as MastodonStatus;
    return NextResponse.json({
      reply: toReply(reply, reply.account?.id, getInstanceHost(session.instance)),
    });
  } catch (error) {
    console.error("[neodb] reply submit failed", error);
    return NextResponse.json({ error: "reply_unavailable" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ReplyRequest | null;
  const postId = body?.postId?.trim();

  if (!postId) {
    return NextResponse.json({ error: "invalid_reply" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/statuses/${encodeURIComponent(postId)}`,
      {
        headers: getHeaders(session),
        method: "DELETE",
      },
      8_000,
    );

    if (!response.ok) {
      return NextResponse.json({ error: "delete_failed" }, { status: response.status });
    }

    return NextResponse.json({ ok: true, postId });
  } catch (error) {
    console.error("[neodb] reply delete failed", error);
    return NextResponse.json({ error: "delete_unavailable" }, { status: 502 });
  }
}

async function getSession() {
  const cookieStore = await cookies();
  return openCookie<NeodbSessionCookie>(cookieStore.get(SESSION_COOKIE)?.value);
}

function getHeaders(session: NeodbSessionCookie | null) {
  return {
    Accept: "application/json",
    ...(session?.accessToken
      ? {
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        }
      : {}),
  };
}

function getInstanceHost(instanceUrl: string) {
  try {
    return new URL(instanceUrl).hostname;
  } catch {
    return "";
  }
}

function toReply(
  status: MastodonStatus,
  currentAccountId?: string,
  instanceHost?: string,
) {
  return {
    acct: toFullAccountHandle(
      status.account?.acct || status.account?.username,
      instanceHost,
    ),
    accountUrl: status.account?.url || "",
    isRemote: isRemoteAccount(status.account?.url, instanceHost),
    avatar: status.account?.avatar || "",
    content: stripHtml(status.content || ""),
    createdAt: status.created_at || "",
    favourited: Boolean(status.favourited ?? status.favorited),
    favouritesCount: status.favourites_count || 0,
    id: status.id || "",
    hasRelatedItem: hasRelatedItem(status),
    inReplyToId: status.in_reply_to_id || "",
    isOwn: Boolean(currentAccountId && status.account?.id === currentAccountId),
    mentions: mapMastodonMentions(status.mentions, instanceHost) || [],
    accountId: status.account?.id || "",
    name: status.account?.display_name || status.account?.username || "",
    username: status.account?.username || "",
  };
}

function hasRelatedItem(status: MastodonStatus) {
  const relatedWith = status.ext_neodb?.relatedWith;

  if (Array.isArray(relatedWith)) {
    return relatedWith.length > 0;
  }

  return Boolean(relatedWith && Object.keys(relatedWith).length > 0);
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
