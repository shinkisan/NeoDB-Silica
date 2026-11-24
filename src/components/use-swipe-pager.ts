"use client";

import { useLayoutEffect, useRef, type HTMLAttributes, type PointerEvent } from "react";
import { DUR, EASE, prefersReducedMotion, rubberBand } from "@/lib/motion";

export type SwipePagerHandlers = Pick<HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture" | "onClickCapture">;

type Gesture = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  offset: number;
  locked: boolean;
};

export function animateTabArrival(element: HTMLElement, offset: number) {
  const reduced = prefersReducedMotion();
  return element.animate?.(
    [{ translate: reduced ? "0px" : `${offset}px`, opacity: 0.4 }, { translate: "0px", opacity: 1 }],
    { duration: reduced ? DUR.exit : DUR.page, easing: EASE.springSoft },
  );
}

export function useSwipePager({
  index, count, onSelect, onProgress,
}: {
  index: number;
  count: number;
  onSelect: (index: number) => void;
  onProgress?: (fraction: number) => void;
}): SwipePagerHandlers {
  const gesture = useRef<Gesture | null>(null);
  const animation = useRef<Animation | undefined>(undefined);
  const swallowClickUntil = useRef(0);
  const pending = useRef<{ element: HTMLDivElement; index: number; offset: number; direction: number } | null>(null);

  useLayoutEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    next.element.style.translate = "";
    if (next.index === index && next.element.isConnected) {
      animation.current?.cancel();
      animation.current = animateTabArrival(next.element, next.direction * Math.min(60, 20 + Math.abs(next.offset) * 0.2));
    }
  }, [index]);

  function finish(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    if (!start.locked) return;

    const element = event.currentTarget;
    const distance = event.clientX - start.x;
    const width = element.clientWidth;
    const direction = distance < 0 ? 1 : -1;
    const nextIndex = index + direction;
    const velocity = event.timeStamp - start.lastTime < 90 ? start.velocity : 0;
    const commit = !cancelled && index >= 0 && nextIndex >= 0 && nextIndex < count &&
      (Math.abs(distance) > width * 0.3 ||
        (Math.abs(distance) > 18 && velocity * -direction > 0.5));

    if (!cancelled) swallowClickUntil.current = performance.now() + 350;
    onProgress?.(0);
    element.style.translate = "";
    animation.current?.cancel();

    if (commit) {
      pending.current = { element, index: nextIndex, offset: start.offset, direction };
      if (!prefersReducedMotion()) {
        animation.current = element.animate?.(
          [{ translate: `${start.offset}px` }, { translate: `${-direction * width}px`, opacity: 0 }],
          { duration: DUR.page, easing: EASE.springSoft },
        );
      }
      onSelect(nextIndex);
    } else if (start.offset && !prefersReducedMotion()) {
      animation.current = element.animate?.(
        [{ translate: `${start.offset}px` }, { translate: "0px" }],
        { duration: DUR.spring, easing: EASE.springSnappy },
      );
    }
  }

  return {
    onPointerDown(event) {
      if (!event.isPrimary || event.pointerType === "mouse") return;
      if ((event.target as Element).closest("input, textarea, select, [data-swipe-ignore], .touch-pan-x")) return;
      swallowClickUntil.current = 0;
      gesture.current = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, offset: 0, locked: false,
      };
    },
    onPointerMove(event) {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!start.locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          gesture.current = null;
          return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
        start.locked = true;
        animation.current?.cancel();
        if (event.nativeEvent.isTrusted) event.currentTarget.setPointerCapture(event.pointerId);
      }
      const elapsed = event.timeStamp - start.lastTime;
      if (elapsed > 0) start.velocity = (event.clientX - start.lastX) / elapsed;
      start.lastX = event.clientX;
      start.lastTime = event.timeStamp;
      const edge = index < 0 || (dx > 0 ? index === 0 : index === count - 1);
      const width = event.currentTarget.clientWidth;
      start.offset = edge ? rubberBand(dx, Math.max(1, width * 0.3)) : dx;
      if (!prefersReducedMotion()) {
        event.currentTarget.style.translate = `${start.offset}px`;
        onProgress?.(-start.offset / Math.max(1, width));
      }
    },
    onPointerUp: (event) => finish(event, false),
    onPointerCancel: (event) => finish(event, true),
    onLostPointerCapture(event) {
      // Retargeting touch capture releases the original child first.
      if (event.target === event.currentTarget) finish(event, true);
    },
    onClickCapture(event) {
      if (event.detail && performance.now() < swallowClickUntil.current) {
        swallowClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}

export function trackCategoryIndicator(viewport: HTMLElement | null, selector: string, fraction: number) {
  if (!viewport) return;
  const categories = Array.from(viewport.querySelectorAll<HTMLElement>(selector));
  const index = categories.findIndex((category) => category.getAttribute("aria-pressed") === "true");
  const current = categories[index];
  const neighbor = categories[index + Math.sign(fraction)];
  const movement = current && neighbor ? (neighbor.offsetLeft - current.offsetLeft) * Math.min(1, Math.abs(fraction)) : 0;
  viewport.style.setProperty("--category-swipe-x", `${movement}px`);
}
