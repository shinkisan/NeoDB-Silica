"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginationPill } from "@/components/pagination-pill";

export function PersonWorksPagination({
  currentPage,
  pages,
}: {
  currentPage: number;
  pages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [activePage, setActivePage] = useState(currentPage);

  useEffect(() => {
    setActivePage(currentPage);
  }, [currentPage, searchKey]);

  if (pages <= 1) {
    return null;
  }

  function goToPage(page: number) {
    const url = new URL(window.location.href);

    if (page <= 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", String(page));
    }

    const href = `${url.pathname}${url.search}`;

    setActivePage(page);
    window.scrollTo({ behavior: "instant", top: 0 });
    router.replace(href, { scroll: false });
  }

  return (
    <div className="flex justify-center">
      <PaginationPill
        activePage={activePage}
        onPageChange={goToPage}
        pages={pages}
      />
    </div>
  );
}
