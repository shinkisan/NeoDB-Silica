"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { RatingBadge } from "@/components/mark-badges";
import { useT } from "@/components/use-t";

const PulseRatingDistributionDialog = dynamic(
  () => import("./pulse-rating-distribution-dialog"),
  { ssr: false },
);

type RatingDistributionBadgeProps = {
  count?: number | null;
  distribution?: number[] | null;
  value: number | null;
};

export function RatingDistributionBadge({
  count,
  distribution,
  value,
}: RatingDistributionBadgeProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isPulseOpen, setIsPulseOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);
  const canOpen = Boolean(value);

  useEffect(() => {
    if (!isOpen && !isPulseOpen) {
      return;
    }

    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsPulseOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, isPulseOpen]);

  useEffect(() => {
    return () => clearLongPressTimer(longPressTimerRef);
  }, []);

  if (!canOpen) {
    return <RatingBadge value={value} />;
  }

  return (
    <>
      <button
        aria-label={t("detail.ratingDistribution.open")}
        className="inline-flex cursor-pointer select-none items-center gap-1 rounded-full transition [-webkit-touch-callout:none] hover:scale-[1.02] active:scale-95"
        onClick={() => {
          if (didLongPressRef.current) {
            didLongPressRef.current = false;
            return;
          }

          setIsOpen(true);
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={() => clearLongPressTimer(longPressTimerRef)}
        onPointerDown={() => {
          clearLongPressTimer(longPressTimerRef);
          didLongPressRef.current = false;
          longPressTimerRef.current = window.setTimeout(() => {
            didLongPressRef.current = true;
            setIsPulseOpen(true);
          }, 3000);
        }}
        onPointerLeave={() => clearLongPressTimer(longPressTimerRef)}
        onPointerUp={() => clearLongPressTimer(longPressTimerRef)}
        type="button"
      >
        <RatingBadge value={value} />
        <ChevronRightIcon />
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <RatingDistributionDialog
              count={count}
              distribution={distribution}
              onClose={() => setIsOpen(false)}
              value={value}
            />,
            document.body,
          )
        : null}
      {isPulseOpen && typeof document !== "undefined"
        ? createPortal(
            <PulseRatingDistributionDialog
              count={count}
              distribution={distribution}
              onClose={() => setIsPulseOpen(false)}
              value={value}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function RatingDistributionDialog({
  count,
  distribution,
  onClose,
  value,
}: {
  count?: number | null;
  distribution?: number[] | null;
  onClose: () => void;
  value: number | null;
}) {
  const t = useT();
  const rows = useMemo(() => normalizeDistribution(distribution), [distribution]);
  const hasDistribution = rows.some((row) => row.value > 0);
  const formattedCount =
    typeof count === "number" && count > 0
      ? new Intl.NumberFormat().format(count)
      : null;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#1a1c1e]/20 px-5 backdrop-blur-sm"
    >
      <section
        aria-modal="true"
        className="w-full max-w-sm rounded-[2rem] border border-white/60 bg-white/85 p-5 text-[var(--foreground)] shadow-2xl shadow-slate-900/15 backdrop-blur-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">
              {t("detail.ratingDistribution.title")}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#75777d]">
              {formattedCount
                ? t("detail.ratingDistribution.count").replace(
                    "{count}",
                    formattedCount,
                  )
                : t("detail.ratingDistribution.noCount")}
            </p>
          </div>
          <button
            aria-label={t("detail.ratingDistribution.close")}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/75 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5">
          <span className="text-4xl font-black leading-none text-[#333e50]">
            {value?.toFixed(1)}
            <span className="ml-1 text-xl font-medium text-[#75777d]">/10</span>
          </span>
        </div>

        <div className="mt-5 space-y-2.5">
          {hasDistribution ? (
            rows.map((row) => (
              <div
                className="grid grid-cols-[2.75rem_minmax(0,1fr)_3rem] items-center gap-2"
                key={row.stars}
              >
                <span className="text-xs font-bold text-[#75777d]">
                  {row.min}-{row.max}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full">
                  <span
                    className="block h-full rounded-full bg-[#333e50]"
                    style={{ width: `${row.value}%` }}
                  />
                </span>
                <span className="text-right text-xs font-bold text-[#75777d]">
                  {formatPercent(row.value)}
                </span>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-[#e2e2e5] bg-white/60 px-4 py-3 text-sm font-semibold text-[#75777d]">
              {t("detail.ratingDistribution.noData")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function normalizeDistribution(distribution?: number[] | null) {
  const values = Array.isArray(distribution) ? distribution.slice(0, 5) : [];
  return [5, 4, 3, 2, 1].map((stars) => ({
    max: stars * 2,
    min: (stars - 1) * 2,
    stars,
    value: Math.max(0, Math.min(100, Number(values[stars - 1]) || 0)),
  }));
}

function clearLongPressTimer(timerRef: React.MutableRefObject<number | null>) {
  if (timerRef.current === null) {
    return;
  }

  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function formatPercent(value: number) {
  if (Number.isInteger(value)) {
    return `${value}%`;
  }

  return `${value.toFixed(1)}%`;
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-[#75777d]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
