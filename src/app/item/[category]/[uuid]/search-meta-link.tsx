"use client";

import Link from "next/link";
import { pushNavigationFrame } from "@/components/navigation-history";
import { DETAIL_RESTORE_PREFIX, DETAIL_SCROLL_PREFIX } from "./detail-state";

type SearchMetaLinkProps = {
  children: React.ReactNode;
  className: string;
  href: string;
};

export function SearchMetaLink({
  children,
  className,
  href,
}: SearchMetaLinkProps) {
  return (
    <Link
      className={className}
      href={href}
      onClick={() => {
        saveCurrentDetailScroll();
        pushNavigationFrame("search", href);
      }}
      onPointerDown={saveCurrentDetailScroll}
    >
      {children}
    </Link>
  );
}

function saveCurrentDetailScroll() {
  const [, appSegment, , uuid] = window.location.pathname.split("/");

  if (appSegment !== "item" || !uuid) {
    return;
  }

  const itemUuid = decodeURIComponent(uuid);

  window.sessionStorage.setItem(
    `${DETAIL_SCROLL_PREFIX}${itemUuid}`,
    String(window.scrollY),
  );
  window.sessionStorage.setItem(`${DETAIL_RESTORE_PREFIX}${itemUuid}`, "1");
}
