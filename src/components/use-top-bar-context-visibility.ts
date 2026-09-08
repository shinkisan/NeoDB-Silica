"use client";

import { useEffect, useState } from "react";

const TOP_BAR_HEIGHT = 64;

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
        setVisibility({
          contextKey,
          isVisible:
            !entry.isIntersecting &&
            entry.boundingClientRect.bottom <= TOP_BAR_HEIGHT,
        });
      },
      {
        rootMargin: `-${TOP_BAR_HEIGHT}px 0px 0px 0px`,
        threshold: 0,
      },
    );

    observer.observe(contextTitle);

    return () => observer.disconnect();
  }, [contextKey, selector]);

  return (
    !selector ||
    (visibility.contextKey === contextKey && visibility.isVisible)
  );
}
