"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COLLECTION_PAGE_PENDING_EVENT } from "./collection-content-frame";
import { replaceNavigationFrame } from "@/components/navigation-history";
import { PaginationPill } from "@/components/pagination-pill";

export function CollectionPagination({
  currentPage,
  pages,
  uuid,
}: {
  currentPage: number;
  pages: number;
  uuid: string;
}) {
  const router = useRouter();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const activePage = pendingPage || currentPage;

  useEffect(() => {
    setPendingPage(null);
  }, [currentPage, uuid]);

  if (pages <= 1) {
    return null;
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > pages || nextPage === currentPage) {
      return;
    }

    setPendingPage(nextPage);
    window.dispatchEvent(
      new CustomEvent(COLLECTION_PAGE_PENDING_EVENT, {
        detail: { page: nextPage },
      }),
    );
    window.scrollTo({ top: 0, behavior: "instant" });
    const href = getCollectionHref(uuid, nextPage);
    replaceNavigationFrame("detail", href);
    router.replace(href);
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-8">
      <PaginationPill
        activePage={activePage}
        className="pointer-events-auto"
        onPageChange={goToPage}
        pages={pages}
      />
    </nav>
  );
}

function getCollectionHref(uuid: string, page: number) {
  const params = new URLSearchParams({ cache: "1" });

  if (page > 1) {
    params.set("page", String(page));
  }

  if (page <= 1) {
    return `/collection/${encodeURIComponent(uuid)}?${params.toString()}`;
  }

  return `/collection/${encodeURIComponent(uuid)}?${params.toString()}`;
}
