"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NumberWheel } from "@/components/number-wheel";
import { useT } from "@/components/use-t";

type MarkDateDialogProps = {
  initialDate: string;
  onCancel: () => void;
  onConfirm: (date: string) => Promise<boolean>;
};

type DateParts = {
  day: number;
  month: number;
  year: number;
};

export function MarkDateDialog({
  initialDate,
  onCancel,
  onConfirm,
}: MarkDateDialogProps) {
  const t = useT();
  const today = parseDateInputValue(getTodayDateInputValue())!;
  const initial = parseDateInputValue(initialDate) || today;
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [isSaving, setIsSaving] = useState(false);
  const maxYear = today.year;
  const minYear = Math.min(1900, maxYear);
  const years = createNumberRange(minYear, maxYear);
  const maxMonth = year === today.year ? today.month : 12;
  const months = createNumberRange(1, maxMonth);
  const maxDay = getMaxDay(year, month, today);
  const days = createNumberRange(1, maxDay);

  function selectYear(nextYear: number) {
    const nextMaxMonth = nextYear === today.year ? today.month : 12;
    const nextMonth = Math.min(month, nextMaxMonth);

    setYear(nextYear);
    setMonth(nextMonth);
    setDay((current) =>
      Math.min(current, getMaxDay(nextYear, nextMonth, today)),
    );
  }

  function selectMonth(nextMonth: number) {
    setMonth(nextMonth);
    setDay((current) =>
      Math.min(current, getMaxDay(year, nextMonth, today)),
    );
  }

  const selectedDate = formatDateInputValue({ day, month, year });
  async function confirmDate() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const ok = await onConfirm(selectedDate);

      if (ok) {
        onCancel();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ConfirmDialog
      cancelLabel={t("confirmDialog.defaultCancel")}
      confirmDisabled={isSaving}
      confirmLabel={
        isSaving ? t("mark.dateSaving") : t("confirmDialog.defaultConfirm")
      }
      onCancel={onCancel}
      onConfirm={confirmDate}
      title={t("mark.date")}
    >
      <div className="relative mx-auto grid h-48 max-w-xs grid-cols-3 gap-2 overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/45 px-2 py-3 shadow-inner">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-xl border border-[#c5c6cd]/50 bg-white/55"
        />
        <NumberWheel
          ariaLabel={t("mark.dateYear")}
          onSelect={selectYear}
          options={years}
          renderLabel={(value) => String(value)}
          selected={year}
        />
        <NumberWheel
          ariaLabel={t("mark.dateMonth")}
          onSelect={selectMonth}
          options={months}
          renderLabel={(value) => String(value).padStart(2, "0")}
          selected={month}
        />
        <NumberWheel
          ariaLabel={t("mark.dateDay")}
          onSelect={setDay}
          options={days}
          renderLabel={(value) => String(value).padStart(2, "0")}
          selected={day}
        />
      </div>
    </ConfirmDialog>
  );
}

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > getDaysInMonth(year, month)
  ) {
    return null;
  }

  return { day, month, year };
}

function formatDateInputValue({ day, month, year }: DateParts) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMaxDay(year: number, month: number, today: DateParts) {
  return year === today.year && month === today.month
    ? today.day
    : getDaysInMonth(year, month);
}

function createNumberRange(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
