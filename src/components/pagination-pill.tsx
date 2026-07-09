"use client";

import { useMemo, type ReactNode } from "react";

type PaginationPillProps = {
  activePage: number;
  className?: string;
  onPageChange: (page: number) => void;
  pages: number;
};

export function PaginationPill({
  activePage,
  className,
  onPageChange,
  pages,
}: PaginationPillProps) {
  const safeActivePage = Math.min(Math.max(activePage, 1), pages);
  const visiblePages = useMemo(
    () => getVisiblePages(safeActivePage, pages),
    [safeActivePage, pages],
  );
  const activeIndex = visiblePages.findIndex((page) => page === safeActivePage);
  const indicatorIndex = activeIndex >= 0 ? activeIndex + 1 : 1;

  if (pages <= 1) {
    return null;
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > pages || nextPage === safeActivePage) {
      return;
    }

    onPageChange(nextPage);
  }

  return (
    <div
      className={`relative flex items-center gap-1 rounded-full border border-white/70 bg-white/60 p-1.5 shadow-lg shadow-slate-900/5 backdrop-blur-2xl ${className || ""}`}
    >
      <span
        aria-hidden="true"
        className="absolute left-1.5 top-1.5 size-10 rounded-full bg-[var(--theme-primary)] shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${indicatorIndex * 2.75}rem)` }}
      />
      <PageControl
        disabled={safeActivePage <= 1}
        onClick={() => goToPage(safeActivePage - 1)}
      >
        <ChevronLeftIcon />
      </PageControl>
      {visiblePages.map((page, index) =>
        page === "ellipsis" ? (
          <span
            className="relative z-10 grid size-10 place-items-center text-sm font-semibold text-[#75777d]"
            key={`ellipsis-${index}`}
          >
            ...
          </span>
        ) : (
          <PageControl
            isActive={page === safeActivePage}
            key={page}
            onClick={() => goToPage(page)}
          >
            {page}
          </PageControl>
        ),
      )}
      <PageControl
        disabled={safeActivePage >= pages}
        onClick={() => goToPage(safeActivePage + 1)}
      >
        <ChevronRightIcon />
      </PageControl>
    </div>
  );
}

function PageControl({
  children,
  disabled,
  isActive,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  isActive?: boolean;
  onClick: () => void;
}) {
  if (disabled) {
    return (
      <span className="relative z-10 grid size-10 place-items-center rounded-full text-[#c5c6cd]">
        {children}
      </span>
    );
  }

  return (
    <button
      className={`relative z-10 grid size-10 cursor-pointer place-items-center rounded-full text-sm font-bold transition-colors duration-300 ${
        isActive ? "text-white" : "text-[#44474c] hover:bg-white/70"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function getVisiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, "ellipsis", total];
  }

  if (current >= total - 2) {
    return [
      1,
      "ellipsis",
      total - 2,
      total - 1,
      total,
    ];
  }

  return [
    1,
    "ellipsis",
    current,
    "ellipsis",
    total,
  ];
}

function ChevronLeftIcon() {
  return <IconPath path="m15 18-6-6 6-6" />;
}

function ChevronRightIcon() {
  return <IconPath path="m9 18 6-6-6-6" />;
}

function IconPath({
  className = "size-5",
  path,
}: {
  className?: string;
  path: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}
