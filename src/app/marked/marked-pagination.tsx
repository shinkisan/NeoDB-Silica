"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShelfType } from "@/components/mark-badges";
import { PaginationPill } from "@/components/pagination-pill";
import { MARKED_LIST_PENDING_EVENT } from "./marked-frame";

type MarkedPaginationProps = {
  category: string;
  currentPage: number;
  pages: number;
  shelf: ShelfType;
};

export function MarkedPagination({
  category,
  currentPage,
  pages,
  shelf,
}: MarkedPaginationProps) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<{
    category: string;
    page: number;
    shelf: ShelfType;
  } | null>(null);
  const activePage =
    pendingTarget?.category === category &&
    pendingTarget.shelf === shelf
      ? pendingTarget.page
      : currentPage;

  if (pages <= 1) {
    return null;
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > pages || nextPage === currentPage) {
      return;
    }

    const href = getMarkedHref({ category, page: nextPage, shelf });

    setPendingTarget({ category, page: nextPage, shelf });
    window.dispatchEvent(new Event(MARKED_LIST_PENDING_EVENT));
    router.replace(href);
  }

  return (
    <div className="flex justify-center pt-2">
      <PaginationPill
        activePage={activePage}
        onPageChange={goToPage}
        pages={pages}
      />
    </div>
  );
}

function getMarkedHref({
  category,
  page,
  shelf,
}: {
  category: string;
  page?: number;
  shelf: ShelfType;
}) {
  // Always set explicitly, even for "all": which category is the default
  // depends on the user's saved tag order, so omitting it here can't safely
  // be read as "the default" by whatever later reads the URL.
  const params = new URLSearchParams({ category, shelf });

  if (page && page > 1) {
    params.set("page", String(page));
  }

  return `/marked?${params.toString()}`;
}
