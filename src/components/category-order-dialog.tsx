"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

type DragState = {
  correction: number;
  itemId: string;
  lastClientY: number;
  pointerId: number;
  startClientY: number;
};

const REORDER_DURATION = 180;
const REORDER_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const DRAG_SCALE = 1.01;

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
  const [orderedItems, setOrderedItems] = useState(() =>
    sortItems(items, readOrder(storageKey)),
  );
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const orderedItemsRef = useRef(orderedItems);
  const previousPositionsRef = useRef<Map<string, number> | null>(null);
  const pendingReorderRef = useRef(false);
  const dragStateRef = useRef<DragState | null>(null);
  const rowAnimationsRef = useRef(new Map<string, Animation>());
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());

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

  useLayoutEffect(() => {
    const previousPositions = previousPositionsRef.current;
    previousPositionsRef.current = null;
    pendingReorderRef.current = false;

    if (!previousPositions) {
      return;
    }

    const dragState = dragStateRef.current;
    const animateRows = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    for (const item of orderedItems) {
      const element = rowElementsRef.current.get(item.id);
      const previousTop = previousPositions.get(item.id);

      if (!element || previousTop === undefined) {
        continue;
      }

      // The dragged row stays glued to the pointer, so the layout shift the
      // reorder just caused is folded into its offset instead of animated.
      if (dragState?.itemId === item.id) {
        dragState.correction =
          previousTop -
          element.offsetTop -
          (dragState.lastClientY - dragState.startClientY);
        applyDragTransform();
        continue;
      }

      rowAnimationsRef.current.get(item.id)?.cancel();
      const offset = previousTop - element.offsetTop;

      if (!animateRows || Math.abs(offset) < 1) {
        continue;
      }

      trackAnimation(
        item.id,
        element.animate(
          [
            { transform: `translateY(${offset}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: REORDER_DURATION, easing: REORDER_EASING },
        ),
      );
    }
  }, [orderedItems]);

  function trackAnimation(itemId: string, animation: Animation) {
    rowAnimationsRef.current.set(itemId, animation);
    animation.onfinish = () => {
      if (rowAnimationsRef.current.get(itemId) === animation) {
        rowAnimationsRef.current.delete(itemId);
      }
    };
  }

  function applyDragTransform() {
    const dragState = dragStateRef.current;

    if (!dragState) {
      return;
    }

    const element = rowElementsRef.current.get(dragState.itemId);

    if (!element) {
      return;
    }

    const offset =
      dragState.lastClientY - dragState.startClientY + dragState.correction;
    element.style.transform = `translateY(${offset}px) scale(${DRAG_SCALE})`;
  }

  function rememberRowPositions() {
    previousPositionsRef.current = new Map(
      Array.from(rowElementsRef.current, ([id, element]) => [
        id,
        visualTopOf(element),
      ]),
    );
  }

  function persistItems(nextItems: CategoryOrderItem[]) {
    const nextOrder = nextItems.map((item) => item.id);

    window.localStorage.setItem(storageKey, JSON.stringify(nextOrder));
    window.dispatchEvent(new CustomEvent(eventName, { detail: nextOrder }));
  }

  function showItems(nextItems: CategoryOrderItem[], persist = false) {
    rememberRowPositions();
    orderedItemsRef.current = nextItems;
    setOrderedItems(nextItems);

    if (persist) {
      persistItems(nextItems);
    }
  }

  function moveItem(itemId: string, direction: -1 | 1) {
    const currentItems = orderedItemsRef.current;
    const index = currentItems.findIndex((item) => item.id === itemId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= currentItems.length) {
      return;
    }

    const nextItems = [...currentItems];
    [nextItems[index], nextItems[nextIndex]] = [
      nextItems[nextIndex],
      nextItems[index],
    ];
    showItems(nextItems, true);
  }

  function reorderToPointer() {
    const dragState = dragStateRef.current;

    // A reorder is already queued; the DOM still shows the previous layout.
    if (!dragState || pendingReorderRef.current) {
      return;
    }

    const element = rowElementsRef.current.get(dragState.itemId);
    const currentItems = orderedItemsRef.current;
    const index = currentItems.findIndex((item) => item.id === dragState.itemId);

    if (!element || index < 0) {
      return;
    }

    const center =
      element.offsetTop +
      dragState.lastClientY -
      dragState.startClientY +
      dragState.correction +
      element.offsetHeight / 2;
    const nextItem = currentItems[index + 1];
    const previousItem = currentItems[index - 1];
    const nextElement = nextItem && rowElementsRef.current.get(nextItem.id);
    const previousElement =
      previousItem && rowElementsRef.current.get(previousItem.id);

    let targetIndex = index;

    if (
      nextElement &&
      center > nextElement.offsetTop + nextElement.offsetHeight / 2
    ) {
      targetIndex = index + 1;
    } else if (
      previousElement &&
      center < previousElement.offsetTop + previousElement.offsetHeight / 2
    ) {
      targetIndex = index - 1;
    }

    if (targetIndex === index) {
      return;
    }

    const nextItems = [...currentItems];
    const [movedItem] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, movedItem);
    pendingReorderRef.current = true;
    showItems(nextItems);
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, itemId: string) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      correction: 0,
      itemId,
      lastClientY: event.clientY,
      pointerId: event.pointerId,
      startClientY: event.clientY,
    };
    setDraggedItemId(itemId);
    applyDragTransform();
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    dragState.lastClientY = event.clientY;
    applyDragTransform();
    reorderToPointer();
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    pendingReorderRef.current = false;
    setDraggedItemId(null);
    settleRow(dragState);
    persistItems(orderedItemsRef.current);
  }

  function settleRow(dragState: DragState) {
    const element = rowElementsRef.current.get(dragState.itemId);

    if (!element) {
      return;
    }

    const offset =
      dragState.lastClientY - dragState.startClientY + dragState.correction;
    element.style.transform = "";
    rowAnimationsRef.current.get(dragState.itemId)?.cancel();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    trackAnimation(
      dragState.itemId,
      element.animate(
        [
          { transform: `translateY(${offset}px) scale(${DRAG_SCALE})` },
          { transform: "translateY(0) scale(1)" },
        ],
        { duration: REORDER_DURATION, easing: REORDER_EASING },
      ),
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <section
        className="review-editor-enter flex max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 pb-2">
          <h2 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
            {title}
          </h2>
          <button
            aria-label={closeLabel}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 press-icon"
            onClick={onClose}
            type="button"
          >
            <IconPath className="size-5" path="M18 6 6 18M6 6l12 12" />
          </button>
        </header>

        <div className="mt-2 min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-white/60 bg-white/45">
          {orderedItems.map((item, index) => (
            <div
              className={`relative flex items-center justify-between gap-3 border-b border-[#c5c6cd]/30 px-2 py-1.5 transition-[background-color,box-shadow] last:border-0 ${
                draggedItemId === item.id
                  ? "z-10 bg-white/70 shadow-md shadow-slate-900/10"
                  : ""
              }`}
              key={item.id}
              ref={(element) => {
                if (element) {
                  rowElementsRef.current.set(item.id, element);
                } else {
                  rowElementsRef.current.delete(item.id);
                }
              }}
            >
              <span className="px-2 text-sm font-bold text-[var(--foreground)]">
                {item.label}
              </span>
              <button
                aria-label={`${item.label} · ${moveUpLabel} / ${moveDownLabel}`}
                className={`grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-full text-[#74777f] transition active:cursor-grabbing ${
                  draggedItemId === item.id
                    ? "bg-white/80 text-[#44474c]"
                    : "hover:bg-white/55"
                }`}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" && index > 0) {
                    event.preventDefault();
                    moveItem(item.id, -1);
                  }
                  if (
                    event.key === "ArrowDown" &&
                    index < orderedItems.length - 1
                  ) {
                    event.preventDefault();
                    moveItem(item.id, 1);
                  }
                }}
                onPointerCancel={endDrag}
                onPointerDown={(event) => startDrag(event, item.id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                type="button"
              >
                <IconPath className="size-5" path="M7 8h10M7 12h10M7 16h10" />
              </button>
            </div>
          ))}
        </div>
        <button
          className="mt-4 h-10 w-full rounded-full border border-white/60 bg-white/45 px-4 text-sm font-bold text-[#44474c] shadow-sm transition hover:bg-white/70 press-control"
          onClick={() => showItems(items, true)}
          type="button"
        >
          {resetLabel}
        </button>
      </section>
    </div>,
    document.body,
  );
}

// Layout position plus any in-flight animated offset, so an interrupted
// reorder animates from where the row actually is on screen.
function visualTopOf(element: HTMLDivElement) {
  const transform = window.getComputedStyle(element).transform;

  return (
    element.offsetTop +
    (transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42)
  );
}

function IconPath({
  className = "size-4",
  path,
}: {
  className?: string;
  path: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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
