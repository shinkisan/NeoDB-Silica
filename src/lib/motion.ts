import { springs } from "./motion-springs";

export const EASE = {
  standard: "cubic-bezier(0.22, 1, 0.36, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  springSoft: springs.soft,
  springSnappy: springs.snappy,
  springBouncy: springs.bouncy,
} as const;

export const DUR = { press: 90, exit: 140, enter: 200, move: 300, spring: 380, page: 420 } as const;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}


let lastTrigger: { element: HTMLElement; time: number } | undefined;

export function rememberMotionTrigger(target: EventTarget | null) {
  const element = target instanceof Element
    ? target.closest<HTMLElement>('button, a[href], [role="button"]')
    : null;
  if (element) lastTrigger = { element, time: performance.now() };
}

export function getRecentMotionTrigger() {
  return lastTrigger?.element.isConnected && performance.now() - lastTrigger.time < 700
    ? lastTrigger.element
    : null;
}

export function rubberBand(distance: number, limit: number) {
  return Math.sign(distance) * (1 - 1 / (Math.abs(distance) * 0.55 / limit + 1)) * limit;
}

export function measureLayout<T>(elements: ReadonlyMap<T, HTMLElement>) {
  return new Map(Array.from(elements, ([key, element]) => [key, element.getBoundingClientRect()]));
}

/** Play a FLIP transition after React has committed the layout change. */
export function flip<T>(
  elements: ReadonlyMap<T, HTMLElement>,
  previous: ReadonlyMap<T, DOMRect>,
  interrupt?: (key: T) => void,
) {
  const reduced = prefersReducedMotion();
  const animations = new Map<T, Animation>();
  for (const [key, element] of elements) {
    const before = previous.get(key);
    if (!before) continue;
    interrupt?.(key);
    if (reduced || !element.animate) continue;
    const after = element.getBoundingClientRect();
    const x = before.left - after.left;
    const y = before.top - after.top;
    if (Math.abs(x) >= 1 || Math.abs(y) >= 1) {
      animations.set(key, element.animate(
        [{ translate: `${x}px ${y}px` }, { translate: "0px 0px" }],
        { duration: DUR.spring, easing: EASE.springSnappy },
      ));
    }
  }
  return animations;
}
