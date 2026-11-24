"use client";

import { useInitialListReveal } from "@/components/use-list-motion";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";
import { useEffect, useRef, useState } from "react";

export const SEARCH_RESULTS_PENDING_EVENT = "app:search-results-pending";

export function SearchResultsFrame({ children, firstPage }: { children: React.ReactNode; firstPage: boolean }) {
  const [isPending, setIsPending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useInitialListReveal(list, !isPending, () => !firstPage ||
    window.sessionStorage.getItem(`${STORAGE_PREFIX}v1:search:restore`) === "1" ||
    document.documentElement.dataset.navDir === "back",
  );

  useEffect(() => {
    function showPendingResults() {
      setIsPending(true);
    }

    window.addEventListener(SEARCH_RESULTS_PENDING_EVENT, showPendingResults);

    return () => {
      window.removeEventListener(
        SEARCH_RESULTS_PENDING_EVENT,
        showPendingResults,
      );
    };
  }, []);

  if (isPending) {
    return <SearchResultsSkeleton />;
  }

  return <div className="content-reveal [--reveal-distance:0px]" ref={list}>{children}</div>;
}

function SearchResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: 9 }, (_, index) => (
        <div
          className="aspect-[3/4] skeleton rounded-xl"
          key={index}
        />
      ))}
    </div>
  );
}
