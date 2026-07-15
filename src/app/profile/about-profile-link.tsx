"use client";

import Link from "next/link";
import { useEffect } from "react";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const PROFILE_ABOUT_RESTORE_KEY = `${STORAGE_PREFIX}v1:profile:about-restore`;
const PROFILE_SCROLL_KEY = `${STORAGE_PREFIX}v1:profile:scroll`;

export function AboutProfileLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  function saveProfileScroll() {
    window.sessionStorage.setItem(PROFILE_SCROLL_KEY, String(window.scrollY));
    window.sessionStorage.setItem(PROFILE_ABOUT_RESTORE_KEY, "1");
  }

  return (
    <Link
      className="flex w-full items-center justify-between border-b-2 border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
      href={href}
      onClick={saveProfileScroll}
      onPointerDown={saveProfileScroll}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef0ea] text-[#364046]">
          <InformationIcon />
        </span>
        <span className="truncate text-base font-semibold text-[var(--foreground)]">
          {label}
        </span>
      </div>
      <ChevronRightIcon />
    </Link>
  );
}

export function ProfileAboutScrollRestorer() {
  useEffect(() => {
    if (window.sessionStorage.getItem(PROFILE_ABOUT_RESTORE_KEY) !== "1") {
      return;
    }

    const storedScroll = Number(
      window.sessionStorage.getItem(PROFILE_SCROLL_KEY) || "0",
    );
    let frame = 0;
    let attempts = 0;
    const startedAt = performance.now();

    function finish() {
      window.sessionStorage.removeItem(PROFILE_ABOUT_RESTORE_KEY);
      window.sessionStorage.setItem(PROFILE_SCROLL_KEY, String(window.scrollY));
    }

    function restore() {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const nextScroll = Math.min(storedScroll, maxScroll);

      window.scrollTo({ top: nextScroll, behavior: "instant" });
      attempts += 1;

      if (
        Math.abs(window.scrollY - nextScroll) <= 2 ||
        performance.now() - startedAt > 1400 ||
        attempts > 48
      ) {
        finish();
        return;
      }

      frame = requestAnimationFrame(restore);
    }

    frame = requestAnimationFrame(restore);

    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
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

function InformationIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}
