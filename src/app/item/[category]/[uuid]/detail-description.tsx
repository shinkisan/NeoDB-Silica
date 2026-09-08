"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/components/use-t";

export function DetailDescription({ text }: { text: string }) {
  const t = useT();
  const textRef = useRef<HTMLParagraphElement>(null);
  const scrollYBeforeExpandRef = useRef<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element || isExpanded) return;

    const measureOverflow = () => {
      setCanExpand(element.scrollHeight - element.clientHeight > 1);
    };
    const frame = requestAnimationFrame(measureOverflow);
    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [isExpanded, text]);

  useLayoutEffect(() => {
    if (!isExpanded || scrollYBeforeExpandRef.current === null) return;

    const scrollY = scrollYBeforeExpandRef.current;
    scrollYBeforeExpandRef.current = null;
    window.scrollTo({ behavior: "instant", top: scrollY });
  }, [isExpanded]);

  return (
    <div className="min-w-0 max-w-full [overflow-anchor:none]">
      <p
        className={`min-w-0 max-w-full whitespace-pre-line break-words text-lg leading-relaxed text-[#44474c] ${
          isExpanded ? "" : "line-clamp-20"
        }`}
        ref={textRef}
      >
        {text}
      </p>
      {canExpand ? (
        <button
          aria-expanded={isExpanded}
          className="ml-auto mt-1.5 flex cursor-pointer items-center gap-1 rounded-full px-1 py-0.5 text-sm font-bold text-[#75777d] transition-[color,transform] hover:text-[var(--foreground)] active:scale-[0.98]"
          onClick={() => {
            if (!isExpanded) {
              scrollYBeforeExpandRef.current = window.scrollY;
            }
            setIsExpanded((current) => !current);
          }}
          type="button"
        >
          {isExpanded
            ? t("detail.description.collapse")
            : t("detail.description.expand")}
          <ChevronIcon isExpanded={isExpanded} />
        </button>
      ) : null}
    </div>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 transition-transform duration-200 ${
        isExpanded ? "rotate-180" : ""
      }`}
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
