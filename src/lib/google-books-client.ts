"use client";

export type BookPageCountSource = "google" | "item";

export async function fetchBookPageCount({
  isbn,
  itemUuid,
}: {
  isbn?: string | null;
  itemUuid?: string | null;
}) {
  const params = new URLSearchParams();

  if (isbn) {
    params.set("isbn", isbn);
  }

  if (itemUuid) {
    params.set("itemUuid", itemUuid);
  }

  const response = await fetch(`/api/google-books/page-count?${params}`, {
    cache: "force-cache",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as {
    pageCount?: unknown;
    source?: unknown;
  } | null;
  const pageCount = Number(payload?.pageCount);

  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    return null;
  }

  return {
    pageCount,
    source: payload?.source === "item" ? "item" : "google",
  } satisfies { pageCount: number; source: BookPageCountSource };
}
