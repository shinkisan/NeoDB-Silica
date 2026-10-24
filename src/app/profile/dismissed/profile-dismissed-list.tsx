"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/app-toast";
import { PaginationPill } from "@/components/pagination-pill";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { getCoverProxySrc } from "@/lib/cover-image";
import type { HomeItem } from "@/lib/neodb";

type DismissedItem = Pick<
  HomeItem,
  | "category"
  | "coverUrl"
  | "creator"
  | "detailPath"
  | "id"
  | "kind"
  | "rating"
  | "title"
>;

/** Categories the home feed can hold, mapped to a label we know exists. */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  book: "search.category.book",
  collection: "homeTags.collection",
  game: "search.category.game",
  movie: "search.category.movie",
  music: "search.category.music",
  podcast: "search.category.podcast",
  tv: "search.category.tv",
};

export function ProfileDismissedList({
  isCoverProxyEnabled,
}: {
  isCoverProxyEnabled: boolean;
}) {
  const t = useT();
  // Null while a page is loading.
  const [items, setItems] = useState<DismissedItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setItems(null);
    setHasError(false);

    try {
      const response = await fetch(`/api/neodb/dismissed?page=${targetPage}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("dismissed list failed");
      }

      const payload = (await response.json()) as {
        items?: DismissedItem[];
        pages?: number;
      };
      const nextPages = payload.pages ?? 1;

      // Restoring the last item of a trailing page leaves it empty.
      if (!payload.items?.length && targetPage > 1) {
        setPage(Math.min(targetPage - 1, nextPages));
        return;
      }

      setItems(payload.items ?? []);
      setPages(nextPages);
    } catch {
      setHasError(true);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load(page));
  }, [load, page]);

  async function restore(item: DismissedItem) {
    if (restoringId) {
      return;
    }

    setRestoringId(item.id);

    try {
      const response = await fetch(
        `/api/neodb/dismiss?itemId=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("restore failed");
      }

      showToast(t("profile.dismissed.restored"));
      await load(page);
    } catch {
      showToast(t("profile.dismissed.restoreError"), "error");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      {items?.length === 0 ? (
        <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm font-semibold text-[#44474c]">
          {hasError ? t("profile.dismissed.loadError") : t("profile.dismissed.empty")}
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item, index) => (
            <DismissedCard
              index={index}
              isCoverProxyEnabled={isCoverProxyEnabled}
              isRestoring={restoringId === item.id}
              item={item}
              key={item.id}
              onRestore={() => void restore(item)}
            />
          ))}
        </div>
      ) : null}

      {items === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="aspect-[3/4] animate-pulse rounded-xl bg-[#e2e2e5]"
              key={index}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <PaginationPill
          activePage={page}
          onPageChange={setPage}
          pages={pages}
        />
      </div>
    </>
  );
}

function DismissedCard({
  index,
  isCoverProxyEnabled,
  isRestoring,
  item,
  onRestore,
}: {
  index: number;
  isCoverProxyEnabled: boolean;
  isRestoring: boolean;
  item: DismissedItem;
  onRestore: () => void;
}) {
  const t = useT();
  const coverSrc = getCoverProxySrc(item.coverUrl, isCoverProxyEnabled);
  const labelKey = CATEGORY_LABEL_KEYS[item.category];
  const label = item.creator || (labelKey ? t(labelKey) : "");

  function openDetail() {
    pushNavigationFrame("detail", item.detailPath);
  }

  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/8 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 press-card">
      <Link
        className="block"
        href={item.detailPath}
        onClick={openDetail}
      >
        <div className="relative aspect-[3/4] bg-[#e2e2e5]">
          {coverSrc ? (
            <Image
              alt={item.title}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
              decoding="async"
              fill
              loading={index < 9 ? "eager" : "lazy"}
              quality={75}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
              src={coverSrc}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-[#75777d]">
              {item.title}
            </div>
          )}
        </div>
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 pt-16">
        <div className="pointer-events-auto translate-y-2 rounded-2xl border border-white/30 bg-white/20 p-2.5 text-white opacity-95 backdrop-blur-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <Link
              className="min-w-0 flex-1"
              href={item.detailPath}
              onClick={openDetail}
            >
              <p className="line-clamp-2 text-sm font-bold leading-snug drop-shadow">
                {item.title}
              </p>
              {label ? (
                <p className="mt-1 truncate text-xs text-white/80">{label}</p>
              ) : null}
            </Link>
            <button
              aria-label={t("profile.dismissed.restore")}
              className="grid size-9 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:cursor-wait press-icon"
              disabled={isRestoring}
              onClick={onRestore}
              type="button"
            >
              {isRestoring ? (
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              ) : (
                <TrashIcon />
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
