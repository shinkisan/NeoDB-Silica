"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const VERSIONS_RESTORE_PREFIX = "bielu:v1:versions-restore:";
const VERSIONS_SCROLL_PREFIX = "bielu:v1:versions-scroll:";

export function VersionsScrollManager({ itemUuid }: { itemUuid: string }) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    const restoreKey = getRestoreKey(itemUuid);

    if (window.sessionStorage.getItem(restoreKey) === "1") {
      restoreVersionsScroll(itemUuid);
      return;
    }

    window.scrollTo({ behavior: "instant", top: 0 });
  }, [itemUuid, searchKey]);

  return null;
}

export function VersionsLoadingScrollTop() {
  useEffect(() => {
    window.scrollTo({ behavior: "instant", top: 0 });
  }, []);

  return null;
}

export function preserveVersionsScroll() {
  const itemUuid = getVersionsItemUuidFromCurrentPath();

  if (!itemUuid) {
    return;
  }

  window.sessionStorage.setItem(getRestoreKey(itemUuid), "1");
  window.sessionStorage.setItem(
    getScrollKey(itemUuid, getCurrentPage()),
    String(window.scrollY),
  );
}

function restoreVersionsScroll(itemUuid: string) {
  const restoreKey = getRestoreKey(itemUuid);
  const scrollKey = getScrollKey(itemUuid, getCurrentPage());
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

function getRestoreKey(itemUuid: string) {
  return `${VERSIONS_RESTORE_PREFIX}${itemUuid}`;
}

function getScrollKey(itemUuid: string, page: number) {
  return `${VERSIONS_SCROLL_PREFIX}${itemUuid}:${page}`;
}

function getCurrentPage() {
  const page = Number(new URL(window.location.href).searchParams.get("page") || 1);

  return Number.isFinite(page) ? Math.max(1, page) : 1;
}

function getVersionsItemUuidFromCurrentPath() {
  const match = /^\/item\/book\/([^/?#]+)\/versions/.exec(
    window.location.pathname,
  );

  return match ? decodeURIComponent(match[1]) : null;
}
