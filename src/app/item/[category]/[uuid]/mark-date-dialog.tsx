"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/components/use-t";

const DATE_WHEEL_ITEM_HEIGHT = 40;

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
  const maxDay =
    year === today.year && month === today.month
      ? today.day
      : getDaysInMonth(year, month);
  const days = createNumberRange(1, maxDay);

  useEffect(() => {
    if (month > maxMonth) {
      setMonth(maxMonth);
    }
  }, [maxMonth, month]);

  useEffect(() => {
    if (day > maxDay) {
      setDay(maxDay);
    }
  }, [day, maxDay]);

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
        <DateWheel
          ariaLabel={t("mark.dateYear")}
          onSelect={setYear}
          options={years}
          renderLabel={(value) => String(value)}
          selected={year}
        />
        <DateWheel
          ariaLabel={t("mark.dateMonth")}
          onSelect={setMonth}
          options={months}
          renderLabel={(value) => String(value).padStart(2, "0")}
          selected={month}
        />
        <DateWheel
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

function DateWheel({
  ariaLabel,
  onSelect,
  options,
  renderLabel,
  selected,
}: {
  ariaLabel: string;
  onSelect: (value: number) => void;
  options: number[];
  renderLabel: (value: number) => string;
  selected: number;
}) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragStartScrollTopRef = useRef(0);
  const dragStartYRef = useRef(0);
  const isPointerDraggingRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPointerDraggingRef.current) {
      return;
    }

    const selectedIndex = options.indexOf(selected);

    if (selectedIndex >= 0) {
      wheelRef.current?.scrollTo({
        top: selectedIndex * DATE_WHEEL_ITEM_HEIGHT,
      });
    }
  }, [options, selected]);

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      aria-label={ariaLabel}
      className="relative z-10 overflow-y-auto py-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onPointerCancel={(event) => {
        if (!isPointerDraggingRef.current || event.pointerType !== "mouse") {
          return;
        }

        isPointerDraggingRef.current = false;
        snapWheelToNearest(event.currentTarget);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") {
          return;
        }

        isPointerDraggingRef.current = true;
        dragStartYRef.current = event.clientY;
        dragStartScrollTopRef.current = event.currentTarget.scrollTop;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!isPointerDraggingRef.current || event.pointerType !== "mouse") {
          return;
        }

        event.preventDefault();
        event.currentTarget.scrollTop =
          dragStartScrollTopRef.current - (event.clientY - dragStartYRef.current);
      }}
      onPointerUp={(event) => {
        if (!isPointerDraggingRef.current || event.pointerType !== "mouse") {
          return;
        }

        isPointerDraggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
        snapWheelToNearest(event.currentTarget);
      }}
      onScroll={(event) => {
        const target = event.currentTarget;
        const nextIndex = Math.round(
          target.scrollTop / DATE_WHEEL_ITEM_HEIGHT,
        );
        const nextValue = options[nextIndex];

        if (nextValue !== undefined && nextValue !== selected) {
          onSelect(nextValue);
        }

        if (isPointerDraggingRef.current) {
          return;
        }

        if (snapTimeoutRef.current !== null) {
          window.clearTimeout(snapTimeoutRef.current);
        }

        snapTimeoutRef.current = window.setTimeout(() => {
          snapWheelToNearest(target);
        }, 90);
      }}
      onWheel={(event) => {
        event.preventDefault();
      }}
      ref={wheelRef}
      role="listbox"
    >
      {options.map((value) => {
        const isSelected = value === selected;

        return (
          <button
            aria-selected={isSelected}
            className={`block h-10 w-full rounded-xl text-center text-base font-semibold transition ${
              isSelected
                ? "text-[var(--foreground)]"
                : "text-[#75777d] hover:text-[var(--foreground)]"
            }`}
            key={value}
            onClick={() => onSelect(value)}
            role="option"
            type="button"
          >
            {renderLabel(value)}
          </button>
        );
      })}
    </div>
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

function createNumberRange(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function snapWheelToNearest(target: HTMLElement) {
  const nextIndex = Math.round(target.scrollTop / DATE_WHEEL_ITEM_HEIGHT);

  target.scrollTo({
    behavior: "smooth",
    top: nextIndex * DATE_WHEEL_ITEM_HEIGHT,
  });
}
