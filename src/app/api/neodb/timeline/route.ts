import crypto from "node:crypto";
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

const PAGE_SIZE = 20;
const PUBLIC_TIMELINE_LIMIT = 40;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  const requestUrl = new URL(request.url);
  const requestedView = requestUrl.searchParams.get("view");
  const view =
    requestedView === "public" || requestedView === "following"
      ? requestedView
      : "mine";
  const maxId = requestUrl.searchParams.get("maxId")?.trim();
  const accountId = requestUrl.searchParams.get("accountId")?.trim();

  if (!session?.accessToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const headers = {
    Accept: "application/json",
    Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
  };
  const instanceHost = getInstanceHost(session.instance);

  configureServerFetchProxy();

  try {
    if (accountId) {
      const account = await fetchMyAccount(session.instance, headers);

      if (!account?.id) {
        return Response.json({ error: "account_missing" }, { status: 502 });
      }

      if (accountId === account.id) {
        const rawStatuses = await fetchFilteredHomeTimelineStatuses(
          session.instance,
          headers,
          account.id,
          instanceHost,
          "own",
          maxId,
        );

        if (!rawStatuses) {
          return Response.json(
            { error: "account_timeline_fetch_failed" },
            { status: 502 },
          );
        }

        return Response.json({
          cacheScope: getCacheScope(session),
          hasMore: Boolean(rawStatuses.nextMaxId),
          nextMaxId: rawStatuses.nextMaxId,
          statuses: rawStatuses.statuses,
        });
      }

      const rawStatuses = await fetchAccountStatuses(
        session.instance,
        headers,
        accountId,
        maxId,
      );

      if (!rawStatuses) {
        return Response.json(
          { error: "account_timeline_fetch_failed" },
          { status: 502 },
        );
      }

      const statuses = mapTimelineStatuses(rawStatuses, account.id, instanceHost);

      return Response.json({
        cacheScope: getCacheScope(session),
        hasMore: statuses.length === PAGE_SIZE,
        nextMaxId: statuses.at(-1)?.id || null,
        statuses,
      });
    }

    if (view === "public") {
      const params = new URLSearchParams({ limit: String(PUBLIC_TIMELINE_LIMIT) });
      const [response, myId] = await Promise.all([
        fetchWithTimeout(
          `${session.instance}/api/v1/trends/statuses?${params.toString()}`,
          { cache: "no-store", headers },
          8_000,
        ),
        fetchMyAccountId(session.instance, headers),
      ]);

      if (!response.ok) {
        return Response.json(
          { error: "public_timeline_fetch_failed" },
          { status: response.status },
        );
      }

      const payload = (await response.json()) as MastodonStatus[];

      return Response.json({
        cacheScope: getCacheScope(session),
        hasMore: false,
        nextMaxId: null,
        statuses: mapTimelineStatuses(payload, myId, instanceHost),
      });
    }

    if (view === "following") {
      const account = await fetchMyAccount(session.instance, headers);

      if (!account?.id) {
        return Response.json(
          { error: "account_fetch_failed" },
          { status: 502 },
        );
      }

      const rawStatuses = await fetchFilteredHomeTimelineStatuses(
        session.instance,
        headers,
        account.id,
        instanceHost,
        "others",
        maxId,
      );

      if (!rawStatuses) {
        return Response.json(
          { error: "following_timeline_fetch_failed" },
          { status: 502 },
        );
      }

      return Response.json({
        cacheScope: getCacheScope(session),
        hasMore: Boolean(rawStatuses.nextMaxId),
        nextMaxId: rawStatuses.nextMaxId,
        statuses: rawStatuses.statuses,
      });
    }

    const account = await fetchMyAccount(session.instance, headers);

    if (!account?.id) {
      return Response.json({ error: "account_missing" }, { status: 502 });
    }

    const rawStatuses = await fetchFilteredHomeTimelineStatuses(
      session.instance,
      headers,
      account.id,
      instanceHost,
      "own",
      maxId,
    );

    if (!rawStatuses) {
      return Response.json({ error: "timeline_fetch_failed" }, { status: 502 });
    }

    return Response.json({
      cacheScope: getCacheScope(session),
      hasMore: Boolean(rawStatuses.nextMaxId),
      nextMaxId: rawStatuses.nextMaxId,
      statuses: rawStatuses.statuses,
    });
  } catch (error) {
    console.error("[neodb] timeline fetch failed", error);
    return Response.json({ error: "timeline_unavailable" }, { status: 502 });
  }
}

async function fetchFilteredHomeTimelineStatuses(
  instance: string,
  headers: Record<string, string>,
  accountId: string,
  instanceHost: string,
  filter: "others" | "own",
  maxId?: string,
) {
  const statuses = [];
  let cursor = maxId || null;
  let nextMaxId: string | null = null;

  for (let attempt = 0; attempt < 5 && statuses.length < PAGE_SIZE; attempt += 1) {
    const page = await fetchHomeTimelinePage(instance, headers, cursor, 40);
    if (!page) return null;

    const filteredStatuses = mapTimelineStatuses(
      page.payload,
      accountId,
      instanceHost,
    ).filter((status) =>
      filter === "own"
        ? status.account.id === accountId
        : status.account.id !== accountId,
    );

    statuses.push(...filteredStatuses);
    nextMaxId = page.nextMaxId;
    cursor = page.nextMaxId;

    if (!cursor) break;
  }

  const pageStatuses = statuses.slice(0, PAGE_SIZE);

  return {
    nextMaxId:
      statuses.length > PAGE_SIZE
        ? pageStatuses.at(-1)?.id || nextMaxId
        : nextMaxId,
    statuses: pageStatuses,
  };
}

async function fetchHomeTimelinePage(
  instance: string,
  headers: Record<string, string>,
  maxId?: string | null,
  limit = PAGE_SIZE,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (maxId) params.set("max_id", maxId);

  const response = await fetchWithTimeout(
    `${instance}/api/v1/timelines/home?${params.toString()}`,
    { cache: "no-store", headers },
    8_000,
  );

  if (!response.ok) return null;

  return {
    nextMaxId: getNextMaxId(response.headers.get("link")),
    payload: (await response.json()) as MastodonStatus[],
  };
}

async function fetchAccountStatuses(
  instance: string,
  headers: Record<string, string>,
  accountId: string,
  maxId?: string,
) {
  const params = new URLSearchParams({
    exclude_reblogs: "false",
    limit: String(PAGE_SIZE),
  });
  if (maxId) {
    params.set("max_id", maxId);
  }

  const response = await fetchWithTimeout(
    `${instance}/api/v1/accounts/${encodeURIComponent(accountId)}/statuses?${params.toString()}`,
    { cache: "no-store", headers },
    8_000,
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MastodonStatus[];
}

async function fetchMyAccountId(
  instance: string,
  headers: Record<string, string>,
) {
  try {
    return (await fetchMyAccount(instance, headers))?.id || null;
  } catch {
    return null;
  }
}

async function fetchMyAccount(
  instance: string,
  headers: Record<string, string>,
) {
  const response = await fetchWithTimeout(
    `${instance}/api/v1/accounts/verify_credentials`,
    { cache: "no-store", headers },
    6_000,
  );

  if (!response.ok) return null;

  return (await response.json()) as MastodonAccount;
}

function getNextMaxId(linkHeader: string | null) {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(",")) {
    if (!/rel="?next"?/i.test(part)) continue;

    const url = /<([^>]+)>/.exec(part)?.[1];
    if (!url) continue;

    try {
      return new URL(url).searchParams.get("max_id");
    } catch {
      return null;
    }
  }

  return null;
}

function getCacheScope(session: NeodbSessionCookie) {
  return crypto
    .createHash("sha256")
    .update(`${session.instance}:${session.createdAt}`)
    .digest("base64url")
    .slice(0, 20);
}
