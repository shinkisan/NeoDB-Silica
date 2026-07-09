"use client";

import { useEffect, useRef, type RefObject } from "react";

type SearchFocusDismissalOptions = {
  inputRef: RefObject<HTMLInputElement | null>;
  onDismiss: () => void;
  rootRef: RefObject<HTMLElement | null>;
};

export function useSearchFocusDismissal({
  inputRef,
  onDismiss,
  rootRef,
}: SearchFocusDismissalOptions) {
  const shouldBlockClickRef = useRef(false);

  useEffect(() => {
    function dismissFocusedSearch(event: PointerEvent) {
      const input = inputRef.current;
      const root = rootRef.current;
      const target = event.target;

      if (
        !input ||
        !root ||
        document.activeElement !== input ||
        !(target instanceof Node) ||
        root.contains(target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      shouldBlockClickRef.current = true;
      input.blur();
      onDismiss();
    }

    function blockDismissedClick(event: MouseEvent) {
      if (!shouldBlockClickRef.current) {
        return;
      }

      shouldBlockClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    document.addEventListener("pointerdown", dismissFocusedSearch, true);
    document.addEventListener("click", blockDismissedClick, true);

    return () => {
      document.removeEventListener("pointerdown", dismissFocusedSearch, true);
      document.removeEventListener("click", blockDismissedClick, true);
    };
  }, [inputRef, onDismiss, rootRef]);
}
