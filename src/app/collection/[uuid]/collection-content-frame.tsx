"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInitialListReveal, useListMotion } from "@/components/use-list-motion";
import { COLLECTION_RESTORE_PREFIX } from "./collection-chrome";
import { useSearchParams } from "next/navigation";

export const COLLECTION_PAGE_PENDING_EVENT = "app:collection-page-pending";

export const COLLECTION_ITEM_REMOVING_EVENT = "app:collection-item-removing";

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

export function CollectionContentFrame({ children, page, uuid }: { children: ReactNode; page: number; uuid: string }) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [isPending, setIsPending] = useState(false);

  const list = useRef<HTMLDivElement>(null);
  const prepareRemoval = useListMotion(list, children);
  useInitialListReveal(list, !isPending, () => page > 1 ||
    window.sessionStorage.getItem(`${COLLECTION_RESTORE_PREFIX}${uuid}`) === "1" ||
    document.documentElement.dataset.navDir === "back",
  );

  useEffect(() => {
    function handleRemoval(event: Event) {
      const removed = (event as CustomEvent<{ uuid: string; itemUuid: string }>).detail;
      if (removed.uuid === uuid) prepareRemoval(removed.itemUuid);
    }
    window.addEventListener(COLLECTION_ITEM_REMOVING_EVENT, handleRemoval);
    return () => window.removeEventListener(COLLECTION_ITEM_REMOVING_EVENT, handleRemoval);
  }, [prepareRemoval, uuid]);

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

  return <div className="content-reveal [--reveal-distance:0px]" ref={list}>{children}</div>;
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
            <div className="aspect-[3/4] skeleton rounded-xl" />
            <div className="space-y-3 py-1">
              <div className="h-5 w-3/4 skeleton rounded-full" />
              <div className="h-6 w-28 skeleton rounded-full" />
              <div className="h-4 w-full skeleton rounded-full" />
              <div className="h-4 w-5/6 skeleton rounded-full" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
