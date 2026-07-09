"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type DropdownOption = {
  color?: string;
  id: string;
  label: string;
};

// Each option row is h-9 (2.25rem); the menu wrapper has p-1 (0.25rem top
// and bottom, 0.5rem total).
const OPTION_HEIGHT_REM = 2.25;
const MENU_VERTICAL_PADDING_REM = 0.5;

type DropdownProps = {
  ariaLabel?: string;
  buttonClassName?: string;
  disabled?: boolean;
  maxVisibleOptions?: number;
  menuClassName?: string;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  options: DropdownOption[];
  overlayClassName?: string;
  showColor?: boolean;
  triggerLabel?: ReactNode;
  value: string;
};

export function Dropdown({
  ariaLabel,
  buttonClassName = "",
  disabled = false,
  maxVisibleOptions,
  menuClassName = "",
  onChange,
  onOpenChange,
  open: controlledOpen,
  options,
  overlayClassName = "",
  showColor = false,
  triggerLabel,
  value,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (disabled) {
        return;
      }

      if (isControlled) {
        onOpenChange?.(next);
      } else {
        setInternalOpen(next);
      }
    },
    [disabled, isControlled, onOpenChange],
  );

  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeOption = useMemo(
    () => options.find((option) => option.id === value) || options[0],
    [options, value],
  );

  useEffect(() => {
    if (!isOpen) {
      setMenuRect(null);
      setMenuPosition(null);
      return;
    }

    function updateMenuRect() {
      if (buttonRef.current) {
        setMenuRect(buttonRef.current.getBoundingClientRect());
      }
    }

    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);

    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [isOpen]);

  // Menu defaults to right-aligned with the button, which can push it past
  // the left edge of narrow (mobile) viewports since its width depends on
  // content (`w-max`). Measure the rendered menu and clamp it back on-screen;
  // runs before paint so the clamp is invisible rather than a visible jump.
  useLayoutEffect(() => {
    if (!isOpen || !menuRect || !menuRef.current) {
      return;
    }

    const viewportPadding = 8;
    const menuWidth = menuRef.current.offsetWidth;
    const preferredLeft = menuRect.right - menuWidth;
    const maxLeft = Math.max(
      window.innerWidth - menuWidth - viewportPadding,
      viewportPadding,
    );

    setMenuPosition({
      left: Math.min(Math.max(preferredLeft, viewportPadding), maxLeft),
      top: menuRect.bottom + 4,
    });
  }, [isOpen, menuRect]);

  const maxMenuHeightRem =
    maxVisibleOptions && options.length > maxVisibleOptions
      ? maxVisibleOptions * OPTION_HEIGHT_REM + MENU_VERTICAL_PADDING_REM
      : null;

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`relative z-[90] inline-flex h-9 items-center gap-2 rounded-full border border-white/70 bg-white/50 px-3 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
        disabled={disabled}
        onClick={() => setOpen(!isOpen)}
        ref={buttonRef}
        type="button"
      >
        {showColor && activeOption.color ? (
          <span
            aria-hidden="true"
            className="size-3 rounded-full shadow-inner ring-1 ring-black/10"
            style={{ backgroundColor: activeOption.color }}
          />
        ) : null}
        <span className="truncate">{triggerLabel ?? activeOption.label}</span>
        <ChevronDownIcon isOpen={isOpen} />
      </button>

      {isOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                className={`fixed inset-0 z-[80] cursor-default ${overlayClassName}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
              <div
                className={`fixed z-[90] min-w-36 w-max overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1 shadow-xl shadow-slate-900/10 ${
                  maxMenuHeightRem ? "overflow-y-auto" : ""
                } ${menuClassName}`}
                ref={menuRef}
                role="listbox"
                style={{
                  ...(menuPosition
                    ? { left: menuPosition.left, top: menuPosition.top }
                    : {
                        left: menuRect.right,
                        top: menuRect.bottom + 4,
                        transform: "translateX(-100%)",
                        visibility: "hidden",
                      }),
                  ...(maxMenuHeightRem ? { maxHeight: `${maxMenuHeightRem}rem` } : {}),
                }}
              >
                {options.map((option) => {
                  const isSelected = option.id === value;

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`flex h-9 w-full items-center rounded-xl px-3 text-xs font-bold whitespace-nowrap transition ${
                        isSelected
                          ? "bg-[var(--theme-primary)] text-white"
                          : "text-[#44474c] hover:bg-[#e2e2e5]/70"
                      }`}
                      key={option.id}
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                      role="option"
                      type="button"
                    >
                      {showColor && option.color ? (
                        <span
                          aria-hidden="true"
                          className="mr-2 size-3 shrink-0 rounded-full shadow-inner ring-1 ring-black/10"
                          style={{ backgroundColor: option.color }}
                        />
                      ) : null}
                      <span className="truncate">{option.label}</span>
                      {isSelected ? <CheckIcon /> : null}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`}
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="ml-auto size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}
