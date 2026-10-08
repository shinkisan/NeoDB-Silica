"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { requestScrollTopOnEntry, rememberScroll } from "@/lib/page-scroll";

/** One row of the profile page's "mine" group. The row, not the target page,
 * knows the navigation is a forward entry, so it asks for the top there — and
 * remembers where this page was, for the way back. */
export function ProfileMineRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  function prepareNavigation() {
    rememberScroll("profile");
    requestScrollTopOnEntry();
  }

  return (
    <Link
      className="flex w-full items-center justify-between border-b border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
      href={href}
      onClick={prepareNavigation}
      onPointerDown={prepareNavigation}
    >
      <div className="flex min-w-0 items-center gap-4">
        {icon}
        <span className="truncate text-base font-semibold text-[var(--foreground)]">
          {label}
        </span>
      </div>
      <ChevronRightIcon />
    </Link>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-[#75777d]"
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
