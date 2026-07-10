"use client";

import { useRouter } from "next/navigation";
import { pushNavigationFrame } from "@/components/navigation-history";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { MARKED_REFRESH_ITEM_KEY } from "./marked-refresh";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const MARKED_RESTORE_KEY = `${STORAGE_PREFIX}v1:marked:restore`;
const MARKED_LEAVING_KEY = `${STORAGE_PREFIX}v1:marked:leaving`;
const MARKED_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:marked:scroll:`;

type MarkedCardBodyProps = {
  children: React.ReactNode;
  className?: string;
  href: string;
  itemUuid: string;
};

export function MarkedCardBody({
  children,
  className,
  href,
  itemUuid,
}: MarkedCardBodyProps) {
  const router = useRouter();

  function shouldIgnoreNavigation(target: EventTarget | null) {
    return target instanceof Element
      ? Boolean(target.closest("[data-card-nav-ignore]"))
      : false;
  }

  function openItem() {
    const key = getMarkedScrollKey(window.location.search.replace(/^\?/, ""));
    window.sessionStorage.setItem(key, String(window.scrollY));
    window.sessionStorage.setItem(MARKED_LEAVING_KEY, "1");
    window.sessionStorage.setItem(MARKED_REFRESH_ITEM_KEY, itemUuid);
    window.sessionStorage.setItem(MARKED_RESTORE_KEY, "1");
    requestDetailScrollTopForHref(href);
    pushNavigationFrame("detail", href);
    router.push(href);
  }

  return (
    <div
      className={className}
      onClick={(event) => {
        if (shouldIgnoreNavigation(event.target)) {
          return;
        }

        openItem();
      }}
      onKeyDown={(event) => {
        if (shouldIgnoreNavigation(event.target)) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openItem();
        }
      }}
      role="link"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function getMarkedScrollKey(search: string) {
  return `${MARKED_SCROLL_PREFIX}${search || "default"}`;
}
