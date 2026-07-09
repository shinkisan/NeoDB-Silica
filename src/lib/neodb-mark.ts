import { type NeodbSessionCookie } from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export const shelfTypes = ["wishlist", "progress", "complete", "dropped"] as const;

export type ShelfType = (typeof shelfTypes)[number];

export type NeodbMarkSnapshot = {
  commentText: string;
  createdTime: string;
  itemUuid: string;
  ratingGrade: number;
  shelfType: ShelfType | null;
  tags: string[];
  visibility: number;
};

type ShelfMark = {
  comment_text?: string | null;
  created_time?: string | null;
  rating_grade?: number | null;
  shelf_type?: ShelfType | null;
  tags?: string[] | null;
  visibility?: number | null;
};

export class NeodbMarkFetchError extends Error {
  status: number;

  constructor(status: number) {
    super(`NeoDB mark fetch failed: ${status}`);
    this.name = "NeodbMarkFetchError";
    this.status = status;
  }
}

export function emptyMarkSnapshot(itemUuid: string): NeodbMarkSnapshot {
  return {
    commentText: "",
    createdTime: "",
    itemUuid,
    ratingGrade: 0,
    shelfType: null,
    tags: [],
    visibility: 0,
  };
}

export async function fetchShelfMarkResponse(
  session: NeodbSessionCookie,
  itemUuid: string,
  timeoutMs = 8_000,
) {
  configureServerFetchProxy();

  return fetchWithTimeout(
    `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
      },
    },
    timeoutMs,
  );
}

export async function fetchShelfMarkSnapshot(
  session: NeodbSessionCookie,
  itemUuid: string,
  timeoutMs = 8_000,
): Promise<NeodbMarkSnapshot> {
  const response = await fetchShelfMarkResponse(session, itemUuid, timeoutMs);

  if (response.status === 404) {
    return emptyMarkSnapshot(itemUuid);
  }

  if (!response.ok) {
    throw new NeodbMarkFetchError(response.status);
  }

  const mark = (await response.json()) as ShelfMark;

  return {
    commentText: mark.comment_text || "",
    createdTime: mark.created_time || "",
    itemUuid,
    ratingGrade: mark.rating_grade || 0,
    shelfType: mark.shelf_type || null,
    tags: Array.isArray(mark.tags) ? mark.tags : [],
    visibility: mark.visibility ?? 0,
  };
}
