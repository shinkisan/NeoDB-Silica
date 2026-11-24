"use client";

import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import { animateTabArrival } from "@/components/use-swipe-pager";
import { prefersReducedMotion } from "@/lib/motion";

type TransitionScope = HTMLDivElement & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

/** Slide tab content horizontally on click selection via scoped view transition or WAAPI fallback. */
export function useTabSlide(ref: RefObject<HTMLDivElement | null>) {
  const transition = useRef<ViewTransition | null>(null);
  const arrival = useRef<Animation | undefined>(undefined);
  const revision = useRef(0);

  useEffect(() => () => {
    revision.current += 1;
    transition.current?.skipTransition();
    arrival.current?.cancel();
  }, []);

  return function slide(direction: number, update: () => void) {
    const scope: TransitionScope | null = ref.current;
    const offset = Math.sign(direction) * 28;
    const selection = ++revision.current;
    transition.current?.skipTransition();
    arrival.current?.cancel();

    if (scope?.startViewTransition && !prefersReducedMotion()) {
      scope.style.setProperty("--tab-slide-offset", `${offset}px`);
      const next = scope.startViewTransition(() => {
        if (selection === revision.current) flushSync(update);
      });
      transition.current = next;
      // A rapid second selection can skip snapshot capture for this one.
      void next.ready.catch(() => {});
      return;
    }

    flushSync(update);
    const content = ref.current;
    if (!content) return;
    arrival.current = animateTabArrival(content, offset);
  };
}
