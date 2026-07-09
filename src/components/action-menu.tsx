"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ActionMenuActionItem = {
  disabled?: boolean;
  href?: string;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  tone?: "default" | "danger";
  type?: "item";
};

type ActionMenuSeparatorItem = {
  key?: string;
  type: "separator";
};

export type ActionMenuItem = ActionMenuActionItem | ActionMenuSeparatorItem;

type ActionMenuProps = {
  buttonClassName?: string;
  items: ActionMenuItem[];
  label: string;
  menuClassName?: string;
  placement?: "bottom" | "top";
  triggerIcon?: React.ReactNode;
};

export function ActionMenu({
  buttonClassName = "",
  items,
  label,
  menuClassName = "",
  placement = "bottom",
  triggerIcon,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setMenuRect(null);
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

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={label}
        className={`grid size-10 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-[0.98] ${buttonClassName}`}
        onClick={() => setIsOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        {triggerIcon || <VerticalDotsIcon />}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                aria-hidden="true"
                className="fixed inset-0 z-[120]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsOpen(false);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
              {menuRect ? (
                <div
                  className={`fixed z-[121] min-w-40 w-max overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1 shadow-xl shadow-slate-900/10 ${menuClassName}`}
                  ref={menuRef}
                  role="menu"
                  style={{
                    left: menuRect.right,
                    top:
                      placement === "top"
                        ? menuRect.top - 4
                        : menuRect.bottom + 4,
                    transform:
                      placement === "top"
                        ? "translate(-100%, -100%)"
                        : "translateX(-100%)",
                  }}
                >
                  {items.map((item, index) =>
                    item.type === "separator" ? (
                      <div
                        aria-hidden="true"
                        className="action-menu-separator mx-2 my-1 h-0 border-t border-[#d6d7dc]"
                        key={item.key || `separator-${index}`}
                        role="separator"
                      />
                    ) : item.href ? (
                      <a
                        className={getItemClassName(item)}
                        href={item.href}
                        key={`${item.label}-${index}`}
                        onClick={() => setIsOpen(false)}
                        rel="noreferrer"
                        role="menuitem"
                        target="_blank"
                      >
                        {item.icon}
                        {item.label}
                      </a>
                    ) : (
                      <button
                        className={getItemClassName(item)}
                        disabled={item.disabled}
                        key={`${item.label}-${index}`}
                        onClick={() => {
                          setIsOpen(false);
                          item.onClick?.();
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function getItemClassName(item: ActionMenuActionItem) {
  const toneClassName =
    item.tone === "danger"
      ? "text-[#b42318] hover:bg-[#fee4e2]"
      : "text-[#44474c] hover:bg-[#e2e2e5]/70";

  return `flex h-9 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:text-[#a4a6ad] disabled:hover:bg-transparent ${toneClassName}`;
}

function VerticalDotsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
