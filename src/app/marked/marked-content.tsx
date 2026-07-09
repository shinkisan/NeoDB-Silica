"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ShelfType } from "@/components/mark-badges";
import { useT } from "@/components/use-t";
import {
  clearMarkedListCategoryCache,
  type MarkedListPayload,
  readMarkedListCache,
  setActiveMarkedListScope,
  writeMarkedListCache,
} from "@/lib/marked-list-cache";
import { isNeodbCategory } from "@/lib/neodb";
import { MarkedCard } from "./marked-card";
import { MarkedFrame } from "./marked-frame";
import { MarkedPagination } from "./marked-pagination";

type MarkedContentProps = {
  cacheScope: string | null;
  categories: Array<{ id: string; label: string }>;
};

export function MarkedContent({ cacheScope, categories }: MarkedContentProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const shelf = parseShelf(searchParams.get("shelf"));
  const categoryValue = searchParams.get("category") || "all";
  const category =
    categoryValue === "all" || isNeodbCategory(categoryValue)
      ? categoryValue
      : "all";
  const parsedPage = Number(searchParams.get("page") || 1);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const [payload, setPayload] = useState<MarkedListPayload | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(cacheScope));
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!cacheScope) {
      queueMicrotask(() => {
        setPayload(null);
        setError(t("marked.loginRequired"));
        setIsLoading(false);
      });
      return;
    }

    setActiveMarkedListScope(cacheScope);
    const cached = readMarkedListCache(cacheScope, shelf, category, page);

    if (cached) {
      queueMicrotask(() => {
        setPayload(cached);
        setError("");
        setIsLoading(false);
        setIsRefreshing(false);
      });
      return;
    }

    const controller = new AbortController();

    queueMicrotask(() => {
      setPayload(null);
      setError("");
      setIsLoading(true);
    });

    fetchMarkedList({ category, page, shelf, signal: controller.signal })
      .then((nextPayload) => {
        writeMarkedListCache(cacheScope, shelf, category, page, nextPayload);
        setPayload(nextPayload);
        setError("");
      })
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "无法读取 NeoDB 标记。",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [cacheScope, category, page, shelf]);

  function refreshAll() {
    if (!cacheScope || isLoading) {
      return;
    }

    clearMarkedListCategoryCache(cacheScope, shelf, category);
    setIsRefreshing(true);
    setIsLoading(true);
    setPayload(null);
    setError("");

    fetchMarkedList({ category, page, shelf })
      .then((nextPayload) => {
        writeMarkedListCache(cacheScope, shelf, category, page, nextPayload);
        setPayload(nextPayload);
      })
      .catch((fetchError: unknown) => {
        setError(
          fetchError instanceof Error ? fetchError.message : "无法读取 NeoDB 标记。",
        );
      })
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-8 text-[var(--foreground)] lg:pl-32 lg:pr-8">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <MarkedFrame
          categories={categories}
          category={category}
          isDataLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={refreshAll}
          shelf={shelf}
        >
          {error ? <EmptyState text={error} /> : null}

          {!error && payload?.items.length === 0 ? (
            <EmptyState text={t("marked.empty")} />
          ) : null}

          {!error && payload?.items.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {payload.items.map(({ item, mark }) => (
                <MarkedCard
                  item={item}
                  key={[
                    mark.item.uuid,
                    mark.shelf_type,
                    mark.created_time,
                    mark.rating_grade,
                    mark.comment_text,
                  ].join(":")}
                  mark={mark}
                  shelf={shelf}
                />
              ))}
            </div>
          ) : null}

          {!error && payload ? (
            <MarkedPagination
              category={category}
              currentPage={page}
              pages={payload.pages}
              shelf={shelf}
            />
          ) : null}
        </MarkedFrame>
      </section>
    </main>
  );
}

async function fetchMarkedList({
  category,
  page,
  shelf,
  signal,
}: {
  category: string;
  page: number;
  shelf: ShelfType;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    category,
    page: String(page),
    shelf,
  });
  const response = await fetch(`/api/neodb/marks?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | (MarkedListPayload & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error || "无法读取 NeoDB 标记。");
  }

  return payload;
}

function parseShelf(value: string | null): ShelfType {
  return value === "progress" ||
    value === "complete" ||
    value === "dropped" ||
    value === "wishlist"
    ? value
    : "wishlist";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="surface-glow rounded-xl border border-white/70 bg-white/55 p-3 text-center text-sm font-semibold text-[#75777d] shadow-lg shadow-slate-900/5">
      {text}
    </div>
  );
}
