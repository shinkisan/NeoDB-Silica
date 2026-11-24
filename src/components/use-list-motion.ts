"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { DUR, EASE, flip, measureLayout, prefersReducedMotion } from "@/lib/motion";

function getItems(root: RefObject<HTMLElement | null>) {
  return new Map(Array.from(
    root.current?.querySelectorAll<HTMLElement>("[data-motion-item]") ?? [],
    (element) => [element.dataset.motionItem!, element],
  ));
}

export function useListMotion(root: RefObject<HTMLElement | null>, content: unknown) {
  const previous = useRef<ReturnType<typeof measureLayout<string>> | null>(null);
  const animations = useRef(new Map<string, Animation>());

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = null;
    if (!before) return;
    animations.current = flip(getItems(root), before, (key) => animations.current.get(key)?.cancel());
  }, [content, root]);

  return useCallback((removedKey?: string) => {
    const items = getItems(root);
    previous.current = measureLayout(items);
    const removed = removedKey ? items.get(removedKey) : undefined;
    const bounds = removedKey ? previous.current.get(removedKey) : undefined;
    if (!removed || !bounds || !removed.animate ||
      bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;

    const copy = removed.cloneNode(true) as HTMLElement;
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    copy.removeAttribute("id");
    for (const element of copy.querySelectorAll("[id]")) element.removeAttribute("id");
    Object.assign(copy.style, {
      position: "fixed",
      top: `${bounds.top}px`,
      left: `${bounds.left}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      margin: "0",
      zIndex: "12",
      overflow: "hidden",
      pointerEvents: "none",
    });
    document.body.append(copy);
    const animation = copy.animate(
      [{ opacity: 1 }, { opacity: 0, scale: prefersReducedMotion() ? 1 : 0.97 }],
      { duration: DUR.exit, easing: EASE.exit, fill: "forwards" },
    );
    void animation.finished.then(() => copy.remove(), () => copy.remove());
  }, [root]);
}

export function useInitialListReveal(
  root: RefObject<HTMLElement | null>,
  ready: boolean,
  skip: () => boolean,
) {
  const played = useRef(false);
  useLayoutEffect(() => {
    if (!ready || played.current) return;
    const items = getItems(root);
    if (!items.size) return;
    played.current = true;
    if (skip()) return;
    const reduced = prefersReducedMotion();
    Array.from(items.values()).slice(0, 8).forEach((item, index) => {
      item.animate?.(
        [{ opacity: 0, translate: reduced ? "0 0" : "0 6px" }, { opacity: 1, translate: "0 0" }],
        { duration: reduced ? DUR.exit : DUR.enter, delay: reduced ? 0 : index * 30, easing: EASE.standard, fill: "backwards" },
      );
    });
  }, [ready, root, skip]);
}
