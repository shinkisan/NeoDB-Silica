"use client";

import Link from "next/link";
import { pushNavigationFrame } from "@/components/navigation-history";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import {
  COLLECTION_RESTORE_PREFIX,
  COLLECTION_SCROLL_PREFIX,
} from "./collection-chrome";

export function CollectionItemLink({
  children,
  href,
  page,
  uuid,
}: {
  children: React.ReactNode;
  href: string;
  page: number;
  uuid: string;
}) {
  return (
    <Link
      className="block"
      href={href}
      onClick={() => {
        window.sessionStorage.setItem(
          `${COLLECTION_SCROLL_PREFIX}${uuid}:${page}`,
          String(window.scrollY),
        );
        window.sessionStorage.setItem(`${COLLECTION_RESTORE_PREFIX}${uuid}`, "1");
        requestDetailScrollTopForHref(href);
        pushNavigationFrame("detail", href);
      }}
    >
      {children}
    </Link>
  );
}
