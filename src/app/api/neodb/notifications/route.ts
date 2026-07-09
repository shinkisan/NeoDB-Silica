import { cookies } from "next/headers";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import {
  getInstanceHost,
  mapTimelineStatuses,
  type MastodonAccount,
  type MastodonStatus,
} from "@/lib/timeline-status";
import { isRemoteAccount } from "@/lib/account-link";
import { mapMastodonEmojis } from "@/lib/mastodon-emoji";
import { toFullAccountHandle } from "@/lib/account-handle";

type MastodonNotification = {
  account?: MastodonAccount;
  created_at?: string;
  id?: string;
  status?: MastodonStatus | null;
  type?: string;
};

const NOTIFICATIONS_PAGE_SIZE = 20;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const maxId = url.searchParams.get("maxId")?.trim();
  const params = new URLSearchParams({ limit: String(NOTIFICATIONS_PAGE_SIZE) });
  if (maxId) params.set("max_id", maxId);

  const headers = {
    Accept: "application/json",
    Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
  };

  configureServerFetchProxy();

  try {
    const [response, myId] = await Promise.all([
      fetchWithTimeout(
        `${session.instance}/api/v1/notifications?${params.toString()}`,
        { cache: "no-store", headers },
        8_000,
      ),
      fetchMyAccountId(session, headers),
    ]);

    if (!response.ok) {
      return Response.json(
        { error: "notifications_fetch_failed" },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as MastodonNotification[];
    const instanceHost = getInstanceHost(session.instance);

    return Response.json({
      hasMore: Boolean(getNextMaxId(response.headers.get("link"))),
      nextMaxId: getNextMaxId(response.headers.get("link")),
      notifications: payload
        .filter((notification) => notification.id)
        .map((notification) => ({
          account: toNotificationActor(notification.account, instanceHost),
          createdAt: notification.created_at || "",
          id: notification.id || "",
          status: notification.status
            ? mapTimelineStatuses([notification.status], myId, instanceHost)[0] || null
            : null,
          type: normalizeNotificationType(notification.type),
        })),
    });
  } catch (error) {
    console.error("[neodb] notifications fetch failed", error);
    return Response.json({ error: "notifications_unavailable" }, { status: 502 });
  }
}

async function fetchMyAccountId(
  session: NeodbSessionCookie,
  headers: Record<string, string>,
) {
  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/accounts/verify_credentials`,
      { cache: "no-store", headers },
      6_000,
    );

    if (!response.ok) return null;

    const account = (await response.json()) as MastodonAccount;
    return account.id || null;
  } catch {
    return null;
  }
}

function toNotificationActor(
  account: MastodonAccount | undefined,
  instanceHost: string,
) {
  return {
    acct: toFullAccountHandle(account?.acct || account?.username, instanceHost),
    avatar: account?.avatar || "",
    displayName: account?.display_name || account?.username || account?.acct || "",
    emojis: mapMastodonEmojis(account?.emojis) || [],
    id: account?.id || "",
    isRemote: isRemoteAccount(account?.url, instanceHost),
    url: account?.url || "",
  };
}

function normalizeNotificationType(value: string | undefined) {
  return value === "favourite" ||
    value === "follow" ||
    value === "mention" ||
    value === "reblog"
    ? value
    : "unknown";
}

function getNextMaxId(linkHeader: string | null) {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(",")) {
    if (!/rel="?next"?/i.test(part)) continue;

    const nextUrl = /<([^>]+)>/.exec(part)?.[1];
    if (!nextUrl) continue;

    try {
      return new URL(nextUrl).searchParams.get("max_id");
    } catch {
      return null;
    }
  }

  return null;
}
