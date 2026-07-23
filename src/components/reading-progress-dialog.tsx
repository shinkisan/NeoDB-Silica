"use client";

import type { ClipboardEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/components/use-t";
import { fetchBookPageCount } from "@/lib/google-books-client";
import {
  formatReadingProgressShort,
  isValidReadingProgressValue,
  type ReadingProgress,
  type ReadingProgressType,
} from "@/lib/reading-progress";
import {
  acknowledgeLocalTotalWarning,
  clearReadingProgressTotals,
  hasAcknowledgedLocalTotalWarning,
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
  const [isConfirmingLocalTotal, setIsConfirmingLocalTotal] = useState(false);
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
  const percentageValue = normalizePercentage(value);
  const options = (["percentage", "page", "chapter"] as const).map((id) => ({
    id,
    label: t(`mark.readingProgress.type.${id}`),
  }));
  const activeTypeIndex = options.findIndex((option) => option.id === type);

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

  async function save(
    progress: ReadingProgress | null,
    acknowledgeLocalTotal = false,
  ) {
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

            if (acknowledgeLocalTotal) {
              acknowledgeLocalTotalWarning(storageScope);
            }
          }
        }

        onCancel();
      }
    } finally {
      setIsSaving(false);
    }
  }

  function requestSave() {
    if (
      needsTotal &&
      totalSource === "manual" &&
      normalizedTotalValue &&
      normalizedTotalValue !== savedTotalValue &&
      !hasAcknowledgedLocalTotalWarning(storageScope)
    ) {
      setIsConfirmingLocalTotal(true);
      return;
    }

    void save({ type, value: normalizedValue });
  }

  function selectType(progressType: ReadingProgressType) {
    if (progressType === type) {
      return;
    }

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
  }

  return (
    <ConfirmDialog
      confirmDisabled={
        isConfirmingClear || isConfirmingLocalTotal
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
            : isConfirmingLocalTotal
              ? t("mark.readingProgress.localTotalWarningContinue")
            : t("confirmDialog.defaultConfirm")
      }
      description={
        isConfirmingClear
          ? t("mark.readingProgress.clearConfirmDescription")
          : isConfirmingLocalTotal
            ? t("mark.readingProgress.localTotalWarningDescription")
          : undefined
      }
      onCancel={() => {
        if (isConfirmingClear) {
          setIsConfirmingClear(false);
          return;
        }

        if (isConfirmingLocalTotal) {
          setIsConfirmingLocalTotal(false);
          return;
        }

        onCancel();
      }}
      onConfirm={() => {
        if (isConfirmingClear) {
          void save(null);
          return;
        }

        if (isConfirmingLocalTotal) {
          void save({ type, value: normalizedValue }, true);
          return;
        }

        requestSave();
      }}
      title={
        isConfirmingClear
          ? t("mark.readingProgress.clearConfirmTitle")
          : isConfirmingLocalTotal
            ? t("mark.readingProgress.localTotalWarningTitle")
          : title
      }
    >
      {isConfirmingClear || isConfirmingLocalTotal ? null : <div className="space-y-3">
        <div>
          <div
            aria-label={t("mark.readingProgress.method")}
            className="h-10 w-full rounded-full border border-white/60 bg-white/45 p-[3px] shadow-inner"
            role="radiogroup"
          >
            <div className="relative grid h-full grid-cols-3">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--theme-primary)] shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${activeTypeIndex * 100}%)` }}
              />
              {options.map((option) => {
                const isActive = option.id === type;

                return (
                  <button
                    aria-checked={isActive}
                    className={`relative z-10 grid h-full place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${
                      isActive ? "text-white" : "text-[#44474c]"
                    }`}
                    key={option.id}
                    onClick={() => selectType(option.id)}
                    role="radio"
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {type === "percentage" ? (
          <div className="pt-2">
            <label
              className="block text-sm font-semibold text-[#44474c]"
              htmlFor="reading-progress-percentage"
            >
              {t("mark.readingProgress.input.percentage")}
            </label>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <button
                aria-label={t("mark.readingProgress.decreasePercentage")}
                className="inline-flex size-8 items-center justify-center rounded-full border border-white/70 bg-white/55 text-lg font-semibold leading-none text-[var(--foreground)] shadow-sm transition hover:bg-white/75 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={percentageValue <= 0}
                onClick={() => setValue(String(percentageValue - 1))}
                type="button"
              >
                -
              </button>
              <div className="flex h-8 w-16 items-center justify-center gap-0.5 rounded-full border border-white/70 bg-white/55 px-2 text-sm font-bold tabular-nums text-[var(--foreground)] shadow-sm transition focus-within:border-[var(--theme-primary)]">
                <input
                  className="w-8 appearance-none bg-transparent text-right outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  id="reading-progress-percentage"
                  inputMode="numeric"
                    max={100}
                    min={0}
                    onChange={(event) => {
                      const nextValue = readNonNegativeInteger(
                        event.target.value,
                      );

                      if (nextValue === null) {
                        return;
                      }

                      setValue(
                        nextValue === ""
                          ? ""
                          : String(normalizePercentage(nextValue)),
                      );
                    }}
                    onClick={selectInputValueOnFinePointer}
                    onFocus={selectInputValueOnFinePointer}
                    onKeyDown={preventNonDigitKey}
                    onPaste={preventNonDigitPaste}
                    step={1}
                  type="number"
                  value={value}
                />
                <span aria-hidden="true">%</span>
              </div>
              <button
                aria-label={t("mark.readingProgress.increasePercentage")}
                className="inline-flex size-8 items-center justify-center rounded-full border border-white/70 bg-white/55 text-lg font-semibold leading-none text-[var(--foreground)] shadow-sm transition hover:bg-white/75 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={percentageValue >= 100}
                onClick={() => setValue(String(percentageValue + 1))}
                type="button"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <span className="mb-2 block text-sm font-semibold text-[#44474c]">
              {t(`mark.readingProgress.input.${type}`)} /{" "}
              {t(`mark.readingProgress.total.${type}`)}
            </span>
            <div className="flex w-full min-w-0 items-center gap-2">
              <input
                aria-label={t(`mark.readingProgress.input.${type}`)}
                autoFocus
                className="h-11 w-0 min-w-0 flex-1 rounded-xl border border-white/70 bg-white/60 px-2 text-center text-base font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--theme-primary)] sm:px-3"
                inputMode="numeric"
                min={0}
                onChange={(event) => {
                  const nextValue = readNonNegativeInteger(event.target.value);

                  if (nextValue !== null) {
                    setValue(nextValue);
                  }
                }}
                onClick={selectInputValueOnFinePointer}
                onFocus={selectInputValueOnFinePointer}
                onKeyDown={preventNonDigitKey}
                onPaste={preventNonDigitPaste}
                step={1}
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
                inputMode="numeric"
                min={0}
                onChange={(event) => {
                  const nextValue = readNonNegativeInteger(event.target.value);

                  if (nextValue === null) {
                    return;
                  }

                  setTotalValue(nextValue);
                  setTotalSource("manual");
                }}
                onClick={selectInputValueOnFinePointer}
                onFocus={selectInputValueOnFinePointer}
                onKeyDown={preventNonDigitKey}
                onPaste={preventNonDigitPaste}
                placeholder={
                  isPageTotalLoading && type === "page"
                    ? t("mark.readingProgress.totalLoading")
                    : undefined
                }
                step={1}
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

function readNonNegativeInteger(value: string) {
  return value === "" || /^\d+$/.test(value) ? value : null;
}

function preventNonDigitKey(event: KeyboardEvent<HTMLInputElement>) {
  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    ["e", "E", "+", "-", ".", ","].includes(event.key)
  ) {
    event.preventDefault();
  }
}

function preventNonDigitPaste(event: ClipboardEvent<HTMLInputElement>) {
  if (!/^\d+$/.test(event.clipboardData.getData("text"))) {
    event.preventDefault();
  }
}

function selectInputValueOnFinePointer(event: {
  currentTarget: HTMLInputElement;
}) {
  if (window.matchMedia("(pointer: fine)").matches) {
    event.currentTarget.select();
  }
}
