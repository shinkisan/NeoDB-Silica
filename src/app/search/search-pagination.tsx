"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replaceNavigationFrame } from "@/components/navigation-history";
import { PaginationPill } from "@/components/pagination-pill";
import { SEARCH_RESULTS_PENDING_EVENT } from "./search-results-frame";

type SearchPaginationProps = {
  category: string;
  currentPage: number;
  pages: number;
  query: string;
};

export function SearchPagination({
  category,
  currentPage,
  pages,
  query,
}: SearchPaginationProps) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<{
    category: string;
    page: number;
    query: string;
  } | null>(null);
  const activePage =
    pendingTarget?.category === category && pendingTarget.query === query
      ? pendingTarget.page
      : currentPage;

  if (pages <= 1) {
    return null;
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > pages || nextPage === currentPage) {
      return;
    }

    const params = new URLSearchParams({
      category,
      page: String(nextPage),
      q: query,
    });

    setPendingTarget({ category, page: nextPage, query });
    window.dispatchEvent(new Event(SEARCH_RESULTS_PENDING_EVENT));
    const href = `/search?${params.toString()}`;
    replaceNavigationFrame("search", href);
    router.replace(href);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-8">
      <PaginationPill
        activePage={activePage}
        className="pointer-events-auto"
        onPageChange={goToPage}
        pages={pages}
      />
    </div>
  );
}
