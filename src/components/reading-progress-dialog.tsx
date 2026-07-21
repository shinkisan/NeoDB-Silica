"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dropdown } from "@/components/dropdown";
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
  const [type, setType] = useState<ReadingProgressType>(
    initialProgress?.type || "percentage",
  );
  const [value, setValue] = useState(initialProgress?.value || "");
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
              setValue("");
              setTotalValue(nextTotal ? String(nextTotal.value) : "");
              setSavedTotalValue(nextTotal ? String(nextTotal.value) : "");
              setTotalSource(nextTotal?.source || null);
            }}
            options={options}
            overlayClassName="z-[140]"
            value={type}
          />
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#44474c]">
            {t(`mark.readingProgress.input.${type}`)}
          </span>
          <input
            autoFocus
            className="h-11 w-full rounded-xl border border-white/70 bg-white/60 px-3 text-base font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--theme-primary)]"
            inputMode="decimal"
            max={type === "percentage" ? 100 : undefined}
            min={0}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t(`mark.readingProgress.placeholder.${type}`)}
            step="any"
            type="number"
            value={value}
          />
        </label>
        {needsTotal ? (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#44474c]">
              {t(`mark.readingProgress.total.${type}`)}
            </span>
            <input
              className="h-11 w-full rounded-xl border border-white/70 bg-white/60 px-3 text-base font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--theme-primary)]"
              inputMode="decimal"
              min={0}
              onChange={(event) => {
                setTotalValue(event.target.value);
                setTotalSource("manual");
              }}
              placeholder={
                isPageTotalLoading && type === "page"
                  ? t("mark.readingProgress.totalLoading")
                  : t(`mark.readingProgress.totalPlaceholder.${type}`)
              }
              step="any"
              type="number"
              value={totalValue}
            />
            {!isCurrentWithinTotal ? (
              <span className="mt-2 block text-xs font-semibold text-red-600">
                {t("mark.readingProgress.totalTooSmall")}
              </span>
            ) : null}
          </label>
        ) : null}
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
