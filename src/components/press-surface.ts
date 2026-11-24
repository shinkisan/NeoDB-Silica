"use client";

import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";

const PRESS_SCALE = 1.16;
const MIN_PRESS_MS = 80;
let press: {
  element: HTMLElement;
  pointerId?: number;
  startedAt: number;
  release: () => void;
} | null = null;
let releaseTimer = 0;

function hold(element: HTMLElement, release: () => void, pointerId?: number) {
  window.clearTimeout(releaseTimer);
  press?.release();
  press = { element, pointerId, release, startedAt: performance.now() };
}

export function startPressFeedback(event: PointerEvent) {
  if (!isPrimaryPress(event) || prefersReducedMotion()) return;
  const element = (event.target as Element).closest?.<HTMLElement>(
    ".press-icon, .press-control, .press-card",
  );
  if (!element || element.matches(':disabled, [aria-disabled="true"]')) return;
  hold(element, () => element.removeAttribute("data-pressed"), event.pointerId);
  element.setAttribute("data-pressed", "");
}

export function endPressFeedback(event: PointerEvent) {
  if (!press || (press.pointerId !== undefined && press.pointerId !== event.pointerId)) return;
  const active = press;
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    if (press !== active) return;
    active.release();
    press = null;
  }, Math.max(0, MIN_PRESS_MS - (performance.now() - active.startedAt)));
}

/** Swells the glass surface while its primary pointer is held. */
export function beginPress(surface: HTMLElement | null) {
  if (!surface || prefersReducedMotion()) return;
  hold(surface, () => {
    surface.style.transition = `transform ${DUR.spring}ms ${EASE.springSnappy}`;
    surface.style.transform = "";
  });
  surface.style.transition = `transform ${DUR.press}ms ${EASE.standard}`;
  surface.style.transform = `scale(${PRESS_SCALE})`;
}

export function isPrimaryPress(event: { button: number; isPrimary: boolean }) {
  return event.isPrimary && event.button === 0;
}
