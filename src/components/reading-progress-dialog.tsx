"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dropdown } from "@/components/dropdown";
import { NumberWheel } from "@/components/number-wheel";
import { useT } from "@/components/use-t";
import { fetchBookPageCount } from "@/lib/google-books-client";
import {
  formatReadingProgressShort,
  isValidReadingProgressValue,
  type ReadingProgress,
  type ReadingProgressType,
} from "@/lib/reading-progress";
import {
  clearReadingProgressTotals,
  readReadingProgressTotals,
  writeReadingProgressTotal,
  type ReadingProgressTotalSource,
} from "@/lib/reading-progress-total";

const PERCENTAGE_OPTIONS = createNumberRange(0, 100);

type ReadingProgressDialogProps = {
  isbn?: string | null;
  itemPageCount?: number | null;
  itemUuid: string;
  initialProgress: ReadingProgress | null;
  onCancel: () => void;
  onSave: (progress: ReadingProgress | null) => Promise<boolean>;
  storageScope: string;
};

export function ReadingProgressDialog({
  isbn,
  itemPageCount,
  itemUuid,
  initialProgress,
  onCancel,
  onSave,
  storageScope,
}: ReadingProgressDialogProps) {
  const t = useT();
  const initialType = initialProgress?.type || "percentage";
  const [type, setType] = useState<ReadingProgressType>(
    initialType,
  );
  const [value, setValue] = useState(() =>
    initialType === "percentage"
      ? String(normalizePercentage(initialProgress?.value))
      : initialProgress?.value || "",
  );
  const [totalValue, setTotalValue] = useState("");
  const [savedTotalValue, setSavedTotalValue] = useState("");
  const [totalSource, setTotalSource] =
    useState<ReadingProgressTotalSource | null>(null);
  const [isPageTotalLoading, setIsPageTotalLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const normalizedValue = value.trim();
  const currentProgressLabel = formatReadingProgressShort(initialProgress, t);
  const title = currentProgressLabel
    ? t("mark.readingProgress.titleWithCurrent").replace(
        "{progress}",
        currentProgressLabel,
      )
    : t("mark.readingProgress.title");
  const isValid = isValidReadingProgressValue(type, normalizedValue);
  const normalizedTotalValue = totalValue.trim();
  const numericCurrentValue = Number(normalizedValue);
  const numericTotalValue = Number(normalizedTotalValue);
  const needsTotal = type === "page" || type === "chapter";
  const isTotalValid =
    !needsTotal ||
    !normalizedTotalValue ||
    (Number.isFinite(numericTotalValue) && numericTotalValue > 0);
  const isCurrentWithinTotal =
    !needsTotal ||
    !normalizedTotalValue ||
    !Number.isFinite(numericCurrentValue) ||
    numericCurrentValue <= numericTotalValue;
  const isUnchanged =
    initialProgress?.type === type &&
    initialProgress.value === normalizedValue &&
    normalizedTotalValue === savedTotalValue;
  const options = (["percentage", "page", "chapter"] as const).map((id) => ({
    id,
    label: t(`mark.readingProgress.type.${id}`),
  }));

  useEffect(() => {
    let cancelled = false;
    const totals = readReadingProgressTotals(storageScope, itemUuid);
    const existing =
      type === "page" || type === "chapter"
        ? totals[type]
        : null;

    queueMicrotask(() => {
      if (!cancelled && existing) {
        setTotalValue(String(existing.value));
        setSavedTotalValue(String(existing.value));
        setTotalSource(existing.source);
      }
    });

    if (totals.page || type !== "page") {
      return () => {
        cancelled = true;
      };
    }

    const normalizedItemPageCount = normalizePositiveNumber(itemPageCount);

    if (normalizedItemPageCount) {
      const nextTotals = writeReadingProgressTotal(
        storageScope,
        itemUuid,
        "page",
        normalizedItemPageCount,
        "item",
      );
      const nextPageTotal = nextTotals.page;

      queueMicrotask(() => {
        if (!cancelled && nextPageTotal) {
          setTotalValue(String(nextPageTotal.value));
          setSavedTotalValue(String(nextPageTotal.value));
          setTotalSource(nextPageTotal.source);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => setIsPageTotalLoading(true));
    fetchBookPageCount({ isbn, itemUuid })
      .then((result) => {
        if (cancelled || !result) {
          return;
        }

        const nextTotals = writeReadingProgressTotal(
          storageScope,
          itemUuid,
          "page",
          result.pageCount,
          result.source,
        );
        const nextPageTotal = nextTotals.page;

        if (nextPageTotal) {
          setTotalValue((current) => current || String(nextPageTotal.value));
          setSavedTotalValue(String(nextPageTotal.value));
          setTotalSource((current) => current || nextPageTotal.source);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPageTotalLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isbn, itemPageCount, itemUuid, storageScope, type]);

  async function save(progress: ReadingProgress | null) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (await onSave(progress)) {
        if (!progress) {
          clearReadingProgressTotals(storageScope, itemUuid);
        } else if (
          progress.type === "page" ||
          progress.type === "chapter"
        ) {
          const total = normalizePositiveNumber(normalizedTotalValue);

          if (total) {
            writeReadingProgressTotal(
              storageScope,
              itemUuid,
              progress.type,
              total,
              totalSource || "manual",
            );
          }
        }

        onCancel();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ConfirmDialog
      confirmDisabled={
        isConfirmingClear
          ? isSaving
          : isSaving ||
            !isValid ||
            !isTotalValid ||
            !isCurrentWithinTotal ||
            isUnchanged
      }
      confirmLabel={
        isSaving
          ? t("mark.readingProgress.saving")
          : isConfirmingClear
            ? t("mark.readingProgress.clear")
            : t("confirmDialog.defaultConfirm")
      }
      description={
        isConfirmingClear
          ? t("mark.readingProgress.clearConfirmDescription")
          : undefined
      }
      onCancel={() => {
        if (isConfirmingClear) {
          setIsConfirmingClear(false);
          return;
        }

        onCancel();
      }}
      onConfirm={() =>
        isConfirmingClear
          ? save(null)
          : save({ type, value: normalizedValue })
      }
      title={
        isConfirmingClear
          ? t("mark.readingProgress.clearConfirmTitle")
          : title
      }
    >
      {isConfirmingClear ? null : <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#44474c]">
            {t("mark.readingProgress.method")}
          </span>
          <Dropdown
            ariaLabel={t("mark.readingProgress.method")}
            buttonClassName="min-w-28 justify-between"
            menuClassName="z-[150]"
            onChange={(nextType) => {
              const progressType = nextType as ReadingProgressType;
              const totals = readReadingProgressTotals(storageScope, itemUuid);
              const nextTotal =
                progressType === "page" || progressType === "chapter"
                  ? totals[progressType]
                  : null;

              setType(progressType);
              setValue(progressType === "percentage" ? "0" : "");
              setTotalValue(nextTotal ? String(nextTotal.value) : "");
              setSavedTotalValue(nextTotal ? String(nextTotal.value) : "");
              setTotalSource(nextTotal?.source || null);
            }}
            options={options}
            overlayClassName="z-[140]"
            value={type}
          />
        </div>
        {type === "percentage" ? (
          <div>
            <span className="mb-2 block text-sm font-semibold text-[#44474c]">
              {t("mark.readingProgress.input.percentage")}
            </span>
            <div className="relative mx-auto h-20 w-60 max-w-full overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/45 shadow-inner">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#c5c6cd]/50 bg-white/55"
              />
              <NumberWheel
                ariaLabel={t("mark.readingProgress.input.percentage")}
                onSelect={(nextValue) => setValue(String(nextValue))}
                options={PERCENTAGE_OPTIONS}
                orientation="horizontal"
                renderLabel={(option) => String(option)}
                selected={normalizePercentage(value)}
              />
            </div>
          </div>
        ) : (
          <div>
            <span className="mb-2 block text-sm font-semibold text-[#44474c]">
              {t(`mark.readingProgress.input.${type}`)} /{" "}
              {t(`mark.readingProgress.total.${type}`)}
            </span>
            <div className="flex w-full min-w-0 items-center gap-2">
              <input
                aria-label={t(`mark.readingProgress.input.${type}`)}
                autoFocus
                className="h-11 w-0 min-w-0 flex-1 rounded-xl border border-white/70 bg-white/60 px-2 text-center text-base font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--theme-primary)] sm:px-3"
                inputMode="decimal"
                min={0}
                onChange={(event) => setValue(event.target.value)}
                step="any"
                type="number"
                value={value}
              />
              <span
                aria-hidden="true"
                className="shrink-0 text-base font-semibold text-[#75777d]"
              >
                /
              </span>
              <input
                aria-label={t(`mark.readingProgress.total.${type}`)}
                className="h-11 w-0 min-w-0 flex-1 rounded-xl border border-white/70 bg-white/60 px-2 text-center text-base font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--theme-primary)] sm:px-3"
                inputMode="decimal"
                min={0}
                onChange={(event) => {
                  setTotalValue(event.target.value);
                  setTotalSource("manual");
                }}
                placeholder={
                  isPageTotalLoading && type === "page"
                    ? t("mark.readingProgress.totalLoading")
                    : undefined
                }
                step="any"
                type="number"
                value={totalValue}
              />
            </div>
            {!isCurrentWithinTotal ? (
              <span className="mt-2 block text-xs font-semibold text-red-600">
                {t("mark.readingProgress.totalTooSmall")}
              </span>
            ) : null}
          </div>
        )}
        {initialProgress ? (
          <button
            className="text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-60"
            disabled={isSaving}
            onClick={() => setIsConfirmingClear(true)}
            type="button"
          >
            {t("mark.readingProgress.clear")}
          </button>
        ) : null}
      </div>}
    </ConfirmDialog>
  );
}

function normalizePositiveNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizePercentage(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

function createNumberRange(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
