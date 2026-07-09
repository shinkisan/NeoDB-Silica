"use client";

import { useEffect, useState } from "react";
import { BackToTopButton } from "@/components/back-to-top";
import { DETAIL_SCROLL_TOP_PREFIX } from "@/lib/detail-scroll";
import {
  DETAIL_COMMUNITY_TAB_PREFIX,
  DETAIL_EDITOR_RETURN_PREFIX,
  DETAIL_RESTORE_PREFIX,
  DETAIL_SCROLL_PREFIX,
} from "./detail-state";

const DETAIL_TOP_BAR_OFFSET = 80;
const DETAIL_SECTION_VISIBILITY_EPSILON = 2;

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

export function DetailPageExitReset({ itemUuid }: { itemUuid: string }) {
  useEffect(() => {
    document.documentElement.dataset.imageViewerOpen = "false";

    function resetExitState() {
      document
        .querySelectorAll("[data-detail-page].detail-page-exit")
        .forEach((element) => {
          element.classList.remove("detail-page-exit");
        });
    }

    resetExitState();
    const frame = requestAnimationFrame(resetExitState);

    window.addEventListener("pageshow", resetExitState);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", resetExitState);
    };
  }, [itemUuid]);

  return null;
}

export function DetailBackToTop() {
  const [hasScrolledPastCommentsStart, setHasScrolledPastCommentsStart] =
    useState(false);

  useEffect(() => {
    let frame = 0;

    function evaluate() {
      frame = 0;
      const target = document.getElementById("comments");
      setHasScrolledPastCommentsStart(
        Boolean(
          target &&
            target.getBoundingClientRect().top <
              DETAIL_TOP_BAR_OFFSET - DETAIL_SECTION_VISIBILITY_EPSILON,
        ),
      );
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    }

    queueMicrotask(evaluate);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <BackToTopButton
      compactTop="5rem"
      compactVisible={hasScrolledPastCommentsStart}
      onBackToTop={scrollToCommentsTop}
      wideBottom="6.5rem"
      wideRight="max(1.25rem, calc(50vw - 34rem))"
      wideVisible={hasScrolledPastCommentsStart}
    />
  );
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

function scrollToCommentsTop() {
  const target = document.getElementById("comments");

  if (!target) {
    window.scrollTo({ behavior: "smooth", top: 0 });
    return;
  }

  const targetTop =
    target.getBoundingClientRect().top + window.scrollY - DETAIL_TOP_BAR_OFFSET;

  window.scrollTo({ behavior: "smooth", top: Math.max(targetTop, 0) });
}
