"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type CategoryOrderItem = {
  id: string;
  label: string;
};

type CategoryOrderDialogProps = {
  closeLabel: string;
  eventName: string;
  items: CategoryOrderItem[];
  moveDownLabel: string;
  moveUpLabel: string;
  onClose: () => void;
  resetLabel: string;
  storageKey: string;
  title: string;
};

export function CategoryOrderDialog({
  closeLabel,
  eventName,
  items,
  moveDownLabel,
  moveUpLabel,
  onClose,
  resetLabel,
  storageKey,
  title,
}: CategoryOrderDialogProps) {
  const [orderedItems, setOrderedItems] = useState(items);

  useEffect(() => {
    queueMicrotask(() => {
      setOrderedItems(sortItems(items, readOrder(storageKey)));
    });
  }, [items, storageKey]);

  useEffect(() => {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  function updateItems(nextItems: CategoryOrderItem[]) {
    const nextOrder = nextItems.map((item) => item.id);

    setOrderedItems(nextItems);
    window.localStorage.setItem(storageKey, JSON.stringify(nextOrder));
    window.dispatchEvent(new CustomEvent(eventName, { detail: nextOrder }));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= orderedItems.length) {
      return;
    }

    const nextItems = [...orderedItems];
    [nextItems[index], nextItems[nextIndex]] = [
      nextItems[nextIndex],
      nextItems[index],
    ];
    updateItems(nextItems);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#1a1c1e]/20 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
          <button
            aria-label={closeLabel}
            className="grid size-9 place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <IconPath path="M18 6 6 18M6 6l12 12" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {orderedItems.map((item, index) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/45 p-2"
              key={item.id}
            >
              <span className="px-2 text-sm font-bold text-[var(--foreground)]">
                {item.label}
              </span>
              <div className="flex gap-1">
                <MoveButton
                  disabled={index === 0}
                  label={moveUpLabel}
                  onClick={() => moveItem(index, -1)}
                >
                  <IconPath path="m6 15 6-6 6 6" />
                </MoveButton>
                <MoveButton
                  disabled={index === orderedItems.length - 1}
                  label={moveDownLabel}
                  onClick={() => moveItem(index, 1)}
                >
                  <IconPath path="m6 9 6 6 6-6" />
                </MoveButton>
              </div>
            </div>
          ))}
        </div>
        <button
          className="mt-4 w-full rounded-full px-4 py-2 text-sm font-bold text-[#44474c] transition hover:bg-white/70"
          onClick={() => updateItems(items)}
          type="button"
        >
          {resetLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function MoveButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid size-9 place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95 disabled:cursor-not-allowed disabled:text-[#c5c6cd] disabled:hover:bg-transparent"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function IconPath({ path }: { path: string }) {
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
      <path d={path} />
    </svg>
  );
}

function readOrder(storageKey: string) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

export function sortItems(items: CategoryOrderItem[], value: unknown) {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const knownIds = new Set(items.map((item) => item.id));
  const orderedIds = ids.filter(
    (id, index) => knownIds.has(id) && ids.indexOf(id) === index,
  );
  const missingIds = items
    .map((item) => item.id)
    .filter((id) => !orderedIds.includes(id));

  return [...orderedIds, ...missingIds]
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is CategoryOrderItem => Boolean(item));
}
