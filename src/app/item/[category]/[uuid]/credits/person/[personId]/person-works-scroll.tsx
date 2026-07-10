"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const PERSON_WORKS_RESTORE_PREFIX = `${STORAGE_PREFIX}v1:person-works-restore:`;
const PERSON_WORKS_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:person-works-scroll:`;

export function PersonWorksScrollManager({ personId }: { personId: string }) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    const restoreKey = getRestoreKey(personId);

    if (window.sessionStorage.getItem(restoreKey) === "1") {
      restorePersonWorksScroll(personId);
      return;
    }

    window.scrollTo({ behavior: "instant", top: 0 });
  }, [personId, searchKey]);

  return null;
}

export function PersonWorksLoadingScrollTop() {
  useEffect(() => {
    window.scrollTo({ behavior: "instant", top: 0 });
  }, []);

  return null;
}

export function preservePersonWorksScroll(personId: string, page?: number) {
  window.sessionStorage.setItem(getRestoreKey(personId), "1");
  window.sessionStorage.setItem(
    getScrollKey(personId, page || getCurrentPage()),
    String(window.scrollY),
  );
}

function restorePersonWorksScroll(personId: string) {
  const restoreKey = getRestoreKey(personId);
  const scrollKey = getScrollKey(personId, getCurrentPage());
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

function getRestoreKey(personId: string) {
  return `${PERSON_WORKS_RESTORE_PREFIX}${personId}`;
}

function getScrollKey(personId: string, page: number) {
  return `${PERSON_WORKS_SCROLL_PREFIX}${personId}:${page}`;
}

function getCurrentPage() {
  const page = Number(new URL(window.location.href).searchParams.get("page") || 1);

  return Number.isFinite(page) ? Math.max(1, page) : 1;
}
