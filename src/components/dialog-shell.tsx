"use client";

import {
  useEffect, useLayoutEffect, useRef, useState,
  type HTMLAttributes, type PointerEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DUR, EASE, getRecentMotionTrigger, prefersReducedMotion, rubberBand } from "@/lib/motion";

const dialogs: HTMLElement[] = [];
let unlockScroll: (() => void) | undefined;
let initialFocus: Element | null = null;

export function useDialogMotion(onClose: () => void) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const complete = useRef(onClose);
  useLayoutEffect(() => { complete.current = onClose; }, [onClose]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  function finishClose() {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    setLeaving(false);
    complete.current();
  }

  function requestClose() {
    if (timer.current !== null) return;
    timer.current = setTimeout(finishClose, DUR.exit + 50);
    setLeaving(true);
  }

  return { leaving, finishClose, requestClose };
}

type DialogShellProps = HTMLAttributes<HTMLDivElement> & ReturnType<typeof useDialogMotion> & {
  backdropClassName?: string;
  children: ReactNode;
  closeOnBackdrop?: boolean;
  origin?: DOMRect;
  portal?: boolean;
  variant?: "center" | "sheet" | "reader";
};

export function DialogShell({
  backdropClassName = "bg-[#e2e2e5]/55 backdrop-blur-sm",
  children, className = "", closeOnBackdrop = true, finishClose, leaving,
  onClick, origin, portal = true, requestClose, variant = "center", ...props
}: DialogShellProps) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const focused = document.activeElement;
    const trigger = getRecentMotionTrigger();
    const previousFocus = focused === document.body || element.contains(focused)
      ? trigger
      : focused;
    const panel = element.querySelector<HTMLElement>(":scope > .dialog-panel");
    if (!element.hasAttribute("aria-label") && !element.hasAttribute("aria-labelledby")) {
      const heading = element.querySelector("h1,h2,h3");
      if (heading?.textContent) element.setAttribute("aria-label", heading.textContent.trim());
    }
    dialogs.push(element);
    if (!unlockScroll) {
      initialFocus = previousFocus;
      const { style } = document.body;
      const previous = { position: style.position, top: style.top, width: style.width };
      const y = window.scrollY;
      style.position = "fixed";
      style.top = `-${y}px`;
      style.width = "100%";
      unlockScroll = () => {
        Object.assign(style, previous);
        window.scrollTo({ top: y, behavior: "instant" });
      };
    }
    if (trigger && panel && !element.contains(trigger)) {
      setPanelOrigin(panel, trigger.getBoundingClientRect());
    }
    if (!element.contains(document.activeElement)) element.focus({ preventScroll: true });
    return () => {
      const index = dialogs.indexOf(element);
      const wasTop = index === dialogs.length - 1;
      if (index >= 0) dialogs.splice(index, 1);
      if (!dialogs.length) {
        unlockScroll?.();
        unlockScroll = undefined;
      }
      const nextFocus = dialogs.length
        ? previousFocus?.isConnected ? previousFocus : dialogs.at(-1)
        : initialFocus;
      if (!dialogs.length) initialFocus = null;
      if (wasTop && nextFocus instanceof HTMLElement && nextFocus.isConnected) {
        nextFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useLayoutEffect(() => {
    const panel = root.current?.querySelector<HTMLElement>(":scope > .dialog-panel");
    if (!panel || !origin) return;
    setPanelOrigin(panel, origin);
  }, [origin]);

  if (portal && typeof document === "undefined") return null;

  const content = (
    <div
      {...props}
      aria-modal="true"
      className={`dialog-shell ${variant === "reader" ? "" : backdropClassName} ${className}`}
      data-leaving={leaving || undefined}
      data-variant={variant}
      ref={root}
      role="dialog"
      tabIndex={-1}
      onClick={(event) => {
        onClick?.(event);
        event.stopPropagation();
        if (event.target === event.currentTarget && closeOnBackdrop) requestClose();
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        const element = event.currentTarget;
        if (event.defaultPrevented || dialogs.at(-1) !== element || !element.contains(event.target as Node)) return;
        if (event.key === "Tab") {
          const focusable = Array.from(element.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]',
          )).filter((control) => control.tabIndex >= 0 && !control.matches(":disabled") && control.getClientRects().length);
          const boundary = event.shiftKey ? focusable.at(0) : focusable.at(-1);
          if (!boundary || event.target === boundary || (event.shiftKey && event.target === element)) {
            event.preventDefault();
            (event.shiftKey ? focusable.at(-1) : focusable.at(0))?.focus();
          }
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          event.preventDefault();
          requestClose();
        }
      }}
      onTransitionEnd={(event) => {
        if (leaving && event.propertyName === "opacity" && event.target === event.currentTarget) finishClose();
      }}
    >
      {children}
    </div>
  );
  return portal ? createPortal(content, document.body) : content;
}


export function DialogSheetHandle({
  leaving,
  requestClose,
}: Pick<DialogShellProps, "leaving" | "requestClose">) {
  const gesture = useRef<{ id: number; y: number; time: number; panel: HTMLElement } | null>(null);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (leaving || gesture.current || !event.isPrimary || event.button !== 0) return;
    const panel = event.currentTarget.closest<HTMLElement>(".dialog-panel");
    if (!panel) return;
    gesture.current = { id: event.pointerId, y: event.clientY, time: event.timeStamp, panel };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId || prefersReducedMotion()) return;
    drag.panel.style.translate = `0px ${rubberBand(Math.max(0, event.clientY - drag.y), Math.max(1, drag.panel.offsetHeight))}px`;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    const distance = event.clientY - drag.y;
    const offset = drag.panel.style.translate;
    drag.panel.style.translate = "";
    if (event.type === "pointerup" && (distance > 120 || (distance > 24 && distance / (event.timeStamp - drag.time) > 0.5))) {
      if (offset) {
        drag.panel.animate?.(
          [{ translate: offset }, { translate: "0px 14px" }],
          { duration: DUR.exit, easing: EASE.exit },
        );
      }
      requestClose();
    } else if (offset) {
      drag.panel.animate?.([{ translate: offset }, { translate: "0 0" }], {
        duration: DUR.spring, easing: EASE.springSnappy,
      });
    }
  }

  return (
    <div
      aria-hidden="true"
      className="dialog-sheet-handle"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    />
  );
}


function setPanelOrigin(panel: HTMLElement, origin: DOMRect) {
  const bounds = panel.getBoundingClientRect();
  panel.style.transformOrigin = `${origin.x + origin.width / 2 - bounds.x}px ${origin.y + origin.height / 2 - bounds.y}px`;
}
