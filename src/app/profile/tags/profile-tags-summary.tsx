"use client";

import { useEffect, useState } from "react";
import { PROFILE_TAGS_PAGE_PENDING_EVENT } from "./profile-tags-content-frame";

type ProfileTagsPagePendingEvent = CustomEvent<{ page: number }>;

export function ProfileTagsSummary({
  currentPage,
  pageLabel,
  pages,
  totalLabel,
}: {
  currentPage: number;
  pageLabel: string;
  pages: number;
  totalLabel: string;
}) {
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const displayPage =
    pendingPage && pendingPage !== currentPage ? pendingPage : currentPage;

  useEffect(() => {
    function showPendingPage(event: Event) {
      setPendingPage((event as ProfileTagsPagePendingEvent).detail.page);
    }

    window.addEventListener(PROFILE_TAGS_PAGE_PENDING_EVENT, showPendingPage);

    return () => {
      window.removeEventListener(
        PROFILE_TAGS_PAGE_PENDING_EVENT,
        showPendingPage,
      );
    };
  }, []);

  return (
    <div className="mb-4 flex items-center justify-between gap-4 px-1 text-sm font-semibold text-[#75777d]">
      <span>{totalLabel}</span>
      <span>
        {pageLabel
          .replace("{page}", String(displayPage))
          .replace("{pages}", String(pages))}
      </span>
    </div>
  );
}
