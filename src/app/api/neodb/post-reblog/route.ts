import { cookies } from "next/headers";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type ReblogRequest = {
  postId?: string;
  reblog?: boolean;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ReblogRequest | null;
  const postId = body?.postId?.trim();

  if (!postId) {
    return Response.json({ error: "invalid_post" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const shouldReblog = body?.reblog !== false;
    const action = shouldReblog ? "reblog" : "unreblog";
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/statuses/${encodeURIComponent(postId)}/${action}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        method: "POST",
      },
      8_000,
    );

    if (!response.ok) {
      return Response.json(
        { error: "reblog_failed" },
        { status: response.status },
      );
    }

    const status = (await response.json()) as {
      id?: string;
      reblogged?: boolean;
      reblogs_count?: number;
    };

    return Response.json({
      postId: status.id || postId,
      reblogged: status.reblogged ?? shouldReblog,
      reblogsCount:
        typeof status.reblogs_count === "number" ? status.reblogs_count : null,
    });
  } catch (error) {
    console.error("[neodb] reblog failed", error);
    return Response.json({ error: "reblog_unavailable" }, { status: 502 });
  }
}
