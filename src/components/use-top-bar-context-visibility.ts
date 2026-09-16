"use client";

import { useEffect, useState } from "react";

const TOP_BAR_HEIGHT = 64;
const TITLE_CLASS = "top-bar-context-title";
const HANDOFF_CLASS = "top-bar-context-handoff";

export function useTopBarContextVisibility({
  contextKey,
  selector,
}: {
  contextKey: string;
  selector?: string;
}) {
  const [visibility, setVisibility] = useState({
    contextKey: "",
    isVisible: false,
  });

  useEffect(() => {
    if (!selector) return;

    const contextTitle = document.querySelector<HTMLElement>(selector);

    if (!contextTitle) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible =
          !entry.isIntersecting &&
          entry.boundingClientRect.bottom <= TOP_BAR_HEIGHT;

        // The bar is translucent, so the heading it takes over from stays
        // legible underneath it and collides with the bar's own title.
        contextTitle.classList.toggle(HANDOFF_CLASS, isVisible);
        setVisibility({ contextKey, isVisible });
      },
      {
        rootMargin: `-${TOP_BAR_HEIGHT}px 0px 0px 0px`,
        threshold: 0,
      },
    );

    contextTitle.classList.add(TITLE_CLASS);
    observer.observe(contextTitle);

    return () => {
      observer.disconnect();
      contextTitle.classList.remove(TITLE_CLASS, HANDOFF_CLASS);
    };
  }, [contextKey, selector]);

  return (
    !selector ||
    (visibility.contextKey === contextKey && visibility.isVisible)
  );
}
