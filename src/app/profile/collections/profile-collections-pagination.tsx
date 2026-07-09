"use client";

import { useRouter } from "next/navigation";
import { PaginationPill } from "@/components/pagination-pill";

export function ProfileCollectionsPagination({
  currentPage,
  pages,
}: {
  currentPage: number;
  pages: number;
}) {
  const router = useRouter();

  if (pages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex justify-center">
      <PaginationPill
        activePage={currentPage}
        onPageChange={(page) => {
          const params = new URLSearchParams(window.location.search);
          params.set("page", String(page));
          router.replace(`/profile/collections?${params.toString()}`);
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
        pages={pages}
      />
    </div>
  );
}
