"use client";

import { useState } from "react";
import { useT } from "@/components/use-t";

const COLLAPSE_THRESHOLD = 180;

export function PersonBiography({ text }: { text: string }) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = text.length > COLLAPSE_THRESHOLD || text.includes("\n");

  if (!shouldCollapse) {
    return (
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#44474c]">
        {text}
      </p>
    );
  }

  if (isExpanded) {
    return (
      <div className="mt-4 text-sm leading-7 text-[#44474c]">
        <p className="whitespace-pre-line">{text}</p>
        <button
          className="ml-auto mt-1 flex cursor-pointer items-center gap-1 text-sm font-bold text-[#75777d] transition hover:text-[var(--foreground)] active:scale-[0.99]"
          onClick={() => setIsExpanded(false)}
          type="button"
        >
          {t("credits.collapseBiography")}
          <ChevronIcon direction="up" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-4 text-sm leading-7 text-[#44474c]">
      <p className="line-clamp-4 whitespace-pre-line">{text}</p>
      <button
        className="ml-auto mt-1 flex cursor-pointer items-center gap-1 text-sm font-bold text-[#75777d] transition hover:text-[var(--foreground)] active:scale-[0.99]"
        onClick={() => setIsExpanded(true)}
        type="button"
      >
        {t("credits.expandBiography")}
        <ChevronIcon direction="down" />
      </button>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "down" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 transition ${direction === "up" ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
