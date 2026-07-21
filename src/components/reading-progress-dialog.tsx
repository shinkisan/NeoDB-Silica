"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/components/use-t";
import {
  formatReadingProgressShort,
  isValidReadingProgressValue,
  type ReadingProgress,
  type ReadingProgressType,
} from "@/lib/reading-progress";

type ReadingProgressDialogProps = {
  initialProgress: ReadingProgress | null;
  onCancel: () => void;
  onSave: (progress: ReadingProgress | null) => Promise<boolean>;
};

export function ReadingProgressDialog({
  initialProgress,
  onCancel,
  onSave,
}: ReadingProgressDialogProps) {
  const t = useT();
  const [type, setType] = useState<ReadingProgressType>(
    initialProgress?.type || "percentage",
  );
  const [value, setValue] = useState(initialProgress?.value || "");
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
  const isUnchanged =
    initialProgress?.type === type && initialProgress.value === normalizedValue;
  const options = (["percentage", "page", "chapter"] as const).map((id) => ({
    id,
    label: t(`mark.readingProgress.type.${id}`),
  }));

  async function save(progress: ReadingProgress | null) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (await onSave(progress)) {
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
          : isSaving || !isValid || isUnchanged
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
              setType(nextType as ReadingProgressType);
              setValue("");
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
