"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SearchScopeOption = {
  id: string;
  label: string;
};

type SearchScopeSelectProps = {
  options: SearchScopeOption[];
  value: string;
  onChange: (value: string) => void;
};

export function SearchScopeSelect({
  options,
  onChange,
  value,
}: SearchScopeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const activeOption =
    options.find((option) => option.id === value) || options[0];

  function openMenu() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setIsClosing(false);
    setMenuRect(null);
    setIsOpen(true);
  }

  function closeMenu() {
    if (!isOpen || isClosing) return;

    setIsClosing(true);
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    closeTimerRef.current = window.setTimeout(
      () => {
        setIsOpen(false);
        setIsClosing(false);
        setMenuRect(null);
        closeTimerRef.current = null;
      },
      prefersReducedMotion ? 0 : 130,
    );
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

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

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        aria-expanded={isOpen && !isClosing}
        aria-haspopup="listbox"
        className="relative z-[90] flex h-10 items-center gap-1.5 px-3 text-sm font-semibold text-[#333e50] transition hover:text-[#111c2c]"
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        ref={buttonRef}
        type="button"
      >
        <span className="max-w-12 truncate sm:max-w-none">
          {activeOption.label}
        </span>
        <ChevronDownIcon isOpen={isOpen && !isClosing} />
      </button>
      <span className="mx-1 h-6 w-px bg-[#c5c6cd]" />

      {isOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                className="fixed inset-0 z-[80] cursor-default"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeMenu();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
              <div
                className={`action-menu-popover action-menu-popover-${
                  isClosing ? "exit" : "enter"
                } fixed z-[90] w-32 overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1 shadow-xl shadow-slate-900/10`}
                data-alignment="left"
                data-placement="bottom"
                role="listbox"
                style={{
                  left: menuRect.left,
                  top: menuRect.bottom + 8,
                }}
              >
                {options.map((option) => {
                  const isSelected = option.id === value;

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`flex h-9 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold transition ${
                        isSelected
                          ? "bg-[var(--theme-primary)] text-white"
                          : "text-[#44474c] hover:bg-[#e2e2e5]/70"
                      }`}
                      key={option.id}
                      onClick={() => {
                        onChange(option.id);
                        closeMenu();
                      }}
                      role="option"
                      type="button"
                    >
                      {option.label}
                      {isSelected ? <CheckIcon /> : null}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 transition ${isOpen ? "rotate-180" : ""}`}
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
      className="size-4"
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
