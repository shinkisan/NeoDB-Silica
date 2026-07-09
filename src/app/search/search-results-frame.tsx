"use client";

import { useEffect, useState } from "react";

export const SEARCH_RESULTS_PENDING_EVENT = "bielu:search-results-pending";

export function SearchResultsFrame({ children }: { children: React.ReactNode }) {
  const [isPending, setIsPending] = useState(false);

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

  return children;
}

function SearchResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: 9 }, (_, index) => (
        <div
          className="aspect-[3/4] animate-pulse rounded-xl bg-[#e2e2e5]"
          key={index}
        />
      ))}
    </div>
  );
}
