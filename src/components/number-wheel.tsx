"use client";

import { useEffect, useRef } from "react";

const VERTICAL_WHEEL_ITEM_SIZE = 40;
const HORIZONTAL_WHEEL_ITEM_SIZE = 48;

type NumberWheelProps = {
  ariaLabel: string;
  onSelect: (value: number) => void;
  options: number[];
  orientation?: "horizontal" | "vertical";
  renderLabel: (value: number) => string;
  selected: number;
};

export function NumberWheel({
  ariaLabel,
  onSelect,
  options,
  orientation = "vertical",
  renderLabel,
  selected,
}: NumberWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragStartPointerPositionRef = useRef(0);
  const dragStartScrollOffsetRef = useRef(0);
  const isPointerDraggingRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);
  const isHorizontal = orientation === "horizontal";
  const itemSize = isHorizontal
    ? HORIZONTAL_WHEEL_ITEM_SIZE
    : VERTICAL_WHEEL_ITEM_SIZE;

  useEffect(() => {
    if (isPointerDraggingRef.current) {
      return;
    }

    const selectedIndex = options.indexOf(selected);

    if (selectedIndex >= 0) {
      wheelRef.current?.scrollTo({
        [isHorizontal ? "left" : "top"]:
          selectedIndex * itemSize,
      });
    }
  }, [isHorizontal, itemSize, options, selected]);

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
      aria-orientation={orientation}
      className={`relative z-10 cursor-grab select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        isHorizontal
          ? "flex h-full touch-pan-x items-center overflow-x-auto px-[calc(50%_-_1.5rem)]"
          : "touch-pan-y overflow-y-auto py-16"
      }`}
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
        dragStartPointerPositionRef.current = isHorizontal
          ? event.clientX
          : event.clientY;
        dragStartScrollOffsetRef.current = getScrollOffset(
          event.currentTarget,
          orientation,
        );
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!isPointerDraggingRef.current || event.pointerType !== "mouse") {
          return;
        }

        event.preventDefault();
        const pointerPosition = isHorizontal ? event.clientX : event.clientY;

        setScrollOffset(
          event.currentTarget,
          orientation,
          dragStartScrollOffsetRef.current -
            (pointerPosition - dragStartPointerPositionRef.current),
        );
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
          getScrollOffset(target, orientation) / itemSize,
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
            className={`${
              isHorizontal ? "h-12 w-12 shrink-0" : "block h-10 w-full"
            } rounded-xl text-center text-base font-semibold transition ${
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

function snapWheelToNearest(target: HTMLElement) {
  const orientation = target.getAttribute("aria-orientation");
  const isHorizontal = orientation === "horizontal";
  const itemSize = isHorizontal
    ? HORIZONTAL_WHEEL_ITEM_SIZE
    : VERTICAL_WHEEL_ITEM_SIZE;
  const nextIndex = Math.round(
    (isHorizontal ? target.scrollLeft : target.scrollTop) / itemSize,
  );

  target.scrollTo({
    behavior: "smooth",
    [isHorizontal ? "left" : "top"]: nextIndex * itemSize,
  });
}

function getScrollOffset(
  target: HTMLElement,
  orientation: "horizontal" | "vertical",
) {
  return orientation === "horizontal" ? target.scrollLeft : target.scrollTop;
}

function setScrollOffset(
  target: HTMLElement,
  orientation: "horizontal" | "vertical",
  value: number,
) {
  if (orientation === "horizontal") {
    target.scrollLeft = value;
  } else {
    target.scrollTop = value;
  }
}
