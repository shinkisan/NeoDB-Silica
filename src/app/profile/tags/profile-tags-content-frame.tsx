"use client";

import { useEffect, useState, type ReactNode } from "react";

export const PROFILE_TAGS_PAGE_PENDING_EVENT = "app:profile-tags-page-pending";

export function ProfileTagsContentFrame({
  children,
}: {
  children: ReactNode;
}) {
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    function showPendingSkeleton() {
      setIsPending(true);
    }

    window.addEventListener(
      PROFILE_TAGS_PAGE_PENDING_EVENT,
      showPendingSkeleton,
    );

    return () => {
      window.removeEventListener(
        PROFILE_TAGS_PAGE_PENDING_EVENT,
        showPendingSkeleton,
      );
    };
  }, []);

  if (isPending) {
    return <ProfileTagsListSkeleton />;
  }

  return children;
}

function ProfileTagsListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3" aria-label="Loading tags">
      {Array.from({ length: 10 }, (_, index) => (
        <article
          className="flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/55 px-5 py-4 shadow-lg shadow-slate-900/5 backdrop-blur-2xl"
          key={index}
        >
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-10 shrink-0 place-items-center text-[#75777d]/45">
              <TagIcon />
            </span>
            <Skeleton className="h-6 w-28 rounded-full sm:w-40" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-3 w-16 rounded-full" />
            <ChevronRightIcon />
          </div>
        </article>
      ))}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-[#e2e2e5]/80 ${className}`}
    />
  );
}

function TagIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-[#75777d]/45"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
