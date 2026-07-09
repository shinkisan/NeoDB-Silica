"use client";

import { useEffect } from "react";

const CREDITS_RESTORE_PREFIX = "bielu:v1:credits-restore:";
const CREDITS_SCROLL_PREFIX = "bielu:v1:credits-scroll:";

export function CreditsScrollManager({
  category,
  itemUuid,
}: {
  category: string;
  itemUuid: string;
}) {
  useEffect(() => {
    const restoreKey = getRestoreKey(category, itemUuid);

    if (window.sessionStorage.getItem(restoreKey) === "1") {
      restoreCreditsScroll(category, itemUuid);
      return;
    }

    window.scrollTo({ behavior: "instant", top: 0 });
  }, [category, itemUuid]);

  return null;
}

export function CreditsLoadingScrollTop() {
  useEffect(() => {
    window.scrollTo({ behavior: "instant", top: 0 });
  }, []);

  return null;
}

export function preserveCreditsScroll(category: string, itemUuid: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getRestoreKey(category, itemUuid), "1");
  window.sessionStorage.setItem(
    getScrollKey(category, itemUuid),
    String(window.scrollY),
  );
}

function restoreCreditsScroll(category: string, itemUuid: string) {
  const restoreKey = getRestoreKey(category, itemUuid);
  const scrollKey = getScrollKey(category, itemUuid);
  const storedScroll = Number(window.sessionStorage.getItem(scrollKey) || "0");

  if (storedScroll <= 0) {
    window.sessionStorage.removeItem(restoreKey);
    return;
  }

  let frame = 0;
  let attempts = 0;
  const startedAt = performance.now();
  const maxDuration = 1400;

  const finish = () => {
    window.sessionStorage.removeItem(restoreKey);
    window.sessionStorage.setItem(scrollKey, String(window.scrollY));
  };

  const restore = () => {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const nextScroll = Math.min(storedScroll, maxScroll);

    window.scrollTo({ behavior: "instant", top: nextScroll });
    attempts += 1;

    if (
      Math.abs(window.scrollY - nextScroll) <= 2 ||
      performance.now() - startedAt > maxDuration ||
      attempts > 48
    ) {
      finish();
      return;
    }

    frame = requestAnimationFrame(restore);
  };

  frame = requestAnimationFrame(restore);

  return () => cancelAnimationFrame(frame);
}

function getRestoreKey(category: string, itemUuid: string) {
  return `${CREDITS_RESTORE_PREFIX}${category}:${itemUuid}`;
}

function getScrollKey(category: string, itemUuid: string) {
  return `${CREDITS_SCROLL_PREFIX}${category}:${itemUuid}`;
}
