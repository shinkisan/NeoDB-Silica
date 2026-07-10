"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export const COLLECTION_PAGE_PENDING_EVENT = "app:collection-page-pending";

type CollectionPagePendingEvent = CustomEvent<{
  page: number;
}>;

export function CollectionPageLabel({
  currentPage,
  label,
  pages,
  totalLabel,
}: {
  currentPage: number;
  label: string;
  pages: number;
  totalLabel: string;
}) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const displayPage = pendingPage || currentPage;

  useEffect(() => {
    setPendingPage(null);
  }, [searchKey]);

  useEffect(() => {
    function handlePending(event: Event) {
      setPendingPage((event as CollectionPagePendingEvent).detail.page);
    }

    window.addEventListener(COLLECTION_PAGE_PENDING_EVENT, handlePending);

    return () => {
      window.removeEventListener(COLLECTION_PAGE_PENDING_EVENT, handlePending);
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-4 px-1 text-sm font-semibold text-[#75777d]">
      <span>{totalLabel}</span>
      <span>
        {label
          .replace("{page}", String(displayPage))
          .replace("{pages}", String(pages))}
      </span>
    </div>
  );
}

export function CollectionIntroFrame({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  useEffect(() => {
    setPendingPage(null);
  }, [searchKey]);

  useEffect(() => {
    function handlePending(event: Event) {
      setPendingPage((event as CollectionPagePendingEvent).detail.page);
    }

    window.addEventListener(COLLECTION_PAGE_PENDING_EVENT, handlePending);

    return () => {
      window.removeEventListener(COLLECTION_PAGE_PENDING_EVENT, handlePending);
    };
  }, []);

  if (pendingPage && pendingPage > 1) {
    return null;
  }

  return children;
}

export function CollectionContentFrame({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsPending(false);
  }, [searchKey]);

  useEffect(() => {
    function handlePending() {
      setIsPending(true);
    }

    window.addEventListener(COLLECTION_PAGE_PENDING_EVENT, handlePending);

    return () => {
      window.removeEventListener(COLLECTION_PAGE_PENDING_EVENT, handlePending);
    };
  }, []);

  if (isPending) {
    return <CollectionItemsSkeleton />;
  }

  return children;
}

function CollectionItemsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 5 }, (_, index) => (
        <article
          className="rounded-2xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5"
          key={index}
        >
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <div className="aspect-[3/4] animate-pulse rounded-xl bg-[#e2e2e5]" />
            <div className="space-y-3 py-1">
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-6 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
