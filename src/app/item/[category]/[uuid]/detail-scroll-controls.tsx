"use client";

import { useEffect } from "react";
import { DETAIL_SCROLL_TOP_PREFIX } from "@/lib/detail-scroll";
import {
  DETAIL_COMMUNITY_TAB_PREFIX,
  DETAIL_EDITOR_RETURN_PREFIX,
  DETAIL_RESTORE_PREFIX,
  DETAIL_SCROLL_PREFIX,
} from "./detail-state";

export function DetailScrollRestorer({ itemUuid }: { itemUuid: string }) {
  useEffect(() => {
    const restoreKey = `${DETAIL_RESTORE_PREFIX}${itemUuid}`;
    const scrollKey = `${DETAIL_SCROLL_PREFIX}${itemUuid}`;
    const scrollTopKey = `${DETAIL_SCROLL_TOP_PREFIX}${itemUuid}`;
    const shouldRestore =
      window.sessionStorage.getItem(restoreKey) === "1" ||
      new URLSearchParams(window.location.search).get("restoreScroll") === "1";
    const shouldScrollTop =
      window.sessionStorage.getItem(scrollTopKey) === "1";

    if (!shouldRestore) {
      if (!shouldScrollTop) {
        return;
      }

      const frame = requestAnimationFrame(() => {
        window.scrollTo({ behavior: "instant", top: 0 });
        window.sessionStorage.removeItem(scrollTopKey);
      });

      return () => cancelAnimationFrame(frame);
    }

    const storedScroll = Number(
      window.sessionStorage.getItem(scrollKey) || "0",
    );

    if (storedScroll <= 0) {
      window.sessionStorage.removeItem(restoreKey);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();

    function restoreScroll() {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );

      window.scrollTo({
        behavior: "instant",
        top: Math.min(storedScroll, maxScroll),
      });

      if (
        Math.abs(window.scrollY - storedScroll) <= 2 ||
        performance.now() - startedAt > 3000
      ) {
        window.sessionStorage.setItem(scrollKey, String(window.scrollY));
        window.sessionStorage.removeItem(restoreKey);
        return;
      }

      frame = requestAnimationFrame(restoreScroll);
    }

    frame = requestAnimationFrame(restoreScroll);

    return () => cancelAnimationFrame(frame);
  }, [itemUuid]);

  return null;
}

export function DetailPageStateReset({ itemUuid }: { itemUuid: string }) {
  useEffect(() => {
    document.documentElement.dataset.detailMediaOverlayOpen = "false";
  }, [itemUuid]);

  return null;
}

export function saveCurrentDetailScroll(itemUuid: string) {
  saveDetailScroll(itemUuid);
  window.sessionStorage.setItem(`${DETAIL_RESTORE_PREFIX}${itemUuid}`, "1");
}

export function saveDetailScroll(itemUuid: string) {
  window.sessionStorage.setItem(
    `${DETAIL_SCROLL_PREFIX}${itemUuid}`,
    String(window.scrollY),
  );
}

export function saveDetailEditorReturn(itemUuid: string) {
  window.sessionStorage.setItem(
    `${DETAIL_EDITOR_RETURN_PREFIX}${itemUuid}`,
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}

export function saveDetailCommunityTab(
  itemUuid: string,
  tab: "comments" | "reviews",
) {
  window.sessionStorage.setItem(`${DETAIL_COMMUNITY_TAB_PREFIX}${itemUuid}`, tab);
}
