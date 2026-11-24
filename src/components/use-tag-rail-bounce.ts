"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { DUR, EASE, prefersReducedMotion, rubberBand } from "@/lib/motion";

const SCROLL_IDLE_MS = 240;
const EDGE_BOUNCE_PX = 12;
const EDGE_PULL_LIMIT_PX = 24;
const MAX_PULL_INPUT_PX = 150;

type TouchGesture = {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  axis: "x" | "y" | null;
};

export function useTagRailBounce(): Pick<HTMLAttributes<HTMLDivElement>,
  "onTouchStart" | "onTouchMove" | "onTouchEnd" | "onTouchCancel" | "onWheel" | "onScroll"
> {
  const touch = useRef<TouchGesture | null>(null);
  const pull = useRef(0);
  const wheelTimer = useRef<number | undefined>(undefined);
  const scroll = useRef<{ direction: number; left: number; time: number } | null>(null);
  const lastScrollLeft = useRef<number | undefined>(undefined);
  const edgeBounce = useRef<Animation | undefined>(undefined);

  useEffect(() => () => {
    window.clearTimeout(wheelTimer.current);
    edgeBounce.current?.cancel();
  }, []);

  function reset(viewport: HTMLDivElement) {
    pull.current = 0;
    delete viewport.dataset.tagRailPulling;
    viewport.style.removeProperty("--tag-rail-offset");
  }

  function canPull(viewport: HTMLDivElement, direction: number) {
    const end = viewport.scrollWidth - viewport.clientWidth;
    return end > 1 && (direction > 0 ? viewport.scrollLeft <= 1 : viewport.scrollLeft >= end - 1);
  }

  function trackScroll(viewport: HTMLDivElement, delta: number) {
    if (!delta) return;
    const direction = Math.sign(delta);
    const now = performance.now();
    if (scroll.current?.direction === direction && now - scroll.current.time <= SCROLL_IDLE_MS) {
      scroll.current.time = now;
    } else {
      scroll.current = { direction, left: lastScrollLeft.current ?? viewport.scrollLeft, time: now };
    }
  }

  function pullAtEdge(viewport: HTMLDivElement, delta: number) {
    if (!delta) return false;
    if (edgeBounce.current?.playState === "running") return false;
    // Native scrolling can reach the boundary before the passive input
    // handler runs. Let the scroll event play the arrival bounce first.
    const movement = scroll.current;
    if (movement && (viewport.scrollLeft - movement.left) * delta < 0) return false;

    const previous = pull.current;
    const next = previous + delta;
    if (prefersReducedMotion() || !canPull(viewport, previous || delta) ||
      (previous && Math.sign(previous) !== Math.sign(next))) {
      reset(viewport);
      return false;
    }

    pull.current = Math.max(-MAX_PULL_INPUT_PX, Math.min(MAX_PULL_INPUT_PX, next));
    viewport.dataset.tagRailPulling = "";
    viewport.style.setProperty("--tag-rail-offset", `${rubberBand(pull.current, EDGE_PULL_LIMIT_PX)}px`);
    return true;
  }

  return {
    onTouchStart(event) {
      window.clearTimeout(wheelTimer.current);
      reset(event.currentTarget);
      scroll.current = null;
      const finger = event.touches.length === 1 ? event.touches[0] : undefined;
      touch.current = finger ? {
        id: finger.identifier,
        startX: finger.clientX,
        startY: finger.clientY,
        lastX: finger.clientX,
        axis: null,
      } : null;
    },
    onTouchMove(event) {
      const gesture = touch.current;
      const finger = event.touches.length === 1 ? event.touches[0] : undefined;
      if (!gesture || !finger || finger.identifier !== gesture.id) return;

      if (!gesture.axis) {
        const x = Math.abs(finger.clientX - gesture.startX);
        const y = Math.abs(finger.clientY - gesture.startY);
        if (Math.max(x, y) < 6) return;
        gesture.axis = x > y ? "x" : "y";
      }
      if (gesture.axis === "y") return;

      const delta = finger.clientX - gesture.lastX;
      trackScroll(event.currentTarget, delta);
      pullAtEdge(event.currentTarget, delta);
      gesture.lastX = finger.clientX;
    },
    onTouchEnd(event) {
      touch.current = null;
      reset(event.currentTarget);
    },
    onTouchCancel(event) {
      touch.current = null;
      reset(event.currentTarget);
    },
    onWheel(event) {
      if (event.ctrlKey || event.metaKey || touch.current) return;
      const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      if (!event.shiftKey && Math.abs(delta) <= Math.abs(event.deltaY)) return;

      const viewport = event.currentTarget;
      trackScroll(viewport, -delta);
      if (!pullAtEdge(viewport, -delta * (event.deltaMode === 1 ? 16 : 1))) return;
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => reset(viewport), 100);
    },
    onScroll(event) {
      const viewport = event.currentTarget;
      const left = viewport.scrollLeft;
      lastScrollLeft.current = left;
      if (pull.current && !canPull(viewport, pull.current)) reset(viewport);

      const movement = scroll.current;
      if (!movement) return;
      const now = performance.now();
      if (now - movement.time > SCROLL_IDLE_MS) {
        scroll.current = null;
        return;
      }

      const previous = movement.left;
      movement.left = left;
      movement.time = now;
      if ((left - previous) * movement.direction >= 0 ||
        !canPull(viewport, movement.direction) || pull.current || prefersReducedMotion()) return;

      scroll.current = null;
      edgeBounce.current?.cancel();
      edgeBounce.current = viewport.firstElementChild?.animate(
        [
          { translate: "0px", easing: EASE.standard },
          { translate: `${EDGE_BOUNCE_PX * movement.direction}px`, offset: 0.3, easing: EASE.springSnappy },
          { translate: "0px" },
        ],
        { duration: DUR.move },
      );
    },
  };
}
