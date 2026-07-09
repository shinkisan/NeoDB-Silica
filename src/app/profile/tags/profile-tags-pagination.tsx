"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaginationPill } from "@/components/pagination-pill";
import { PROFILE_TAGS_PAGE_PENDING_EVENT } from "./profile-tags-content-frame";

export function ProfileTagsPagination({
  basePath = "/profile/tags",
  currentPage,
  pages,
}: {
  basePath?: string;
  currentPage: number;
  pages: number;
}) {
  const router = useRouter();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const activePage =
    pendingPage && pendingPage !== currentPage ? pendingPage : currentPage;

  if (pages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex justify-center">
      <PaginationPill
        activePage={activePage}
        onPageChange={(page) => {
          const params = new URLSearchParams(window.location.search);
          params.set("page", String(page));
          setPendingPage(page);
          window.dispatchEvent(
            new CustomEvent(PROFILE_TAGS_PAGE_PENDING_EVENT, {
              detail: { page },
            }),
          );
          router.replace(`${basePath}?${params.toString()}`);
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
        pages={pages}
      />
    </div>
  );
}
