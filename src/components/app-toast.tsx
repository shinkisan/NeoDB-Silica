"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";

type ToastTone = "error" | "success";

type ToastPayload = {
  message: string;
  tone?: ToastTone;
};

const TOAST_EVENT_NAME = "app:toast";

export function showToast(message: string, tone: ToastTone = "success") {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, {
      detail: { message, tone },
    }),
  );
}

export function AppToast() {
  const [toast, setToast] = useState<(ToastPayload & { id: number; previous?: string }) | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const layout = useRef<{ width: number; animation?: Animation }>({ width: 0 });

  useEffect(() => {
    let id = 0;
    function handleToast(event: Event) {
      const payload = (event as CustomEvent<ToastPayload>).detail;
      if (!payload?.message) return;
      if (timer.current !== null) clearTimeout(timer.current);
      const currentId = ++id;
      setLeaving(false);
      setToast((previous) => ({ ...payload, id: currentId, previous: previous?.message }));
      timer.current = setTimeout(() => {
        setLeaving(true);
        timer.current = setTimeout(() => setToast(null), DUR.exit + 50);
      }, 1800);
    }
    window.addEventListener(TOAST_EVENT_NAME, handleToast);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, handleToast);
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const element = surface.current;
    const previous = layout.current;
    previous.animation?.cancel();
    if (!element) {
      layout.current = { width: 0 };
      return;
    }
    const width = element.offsetWidth;
    layout.current = { width };
    if (prefersReducedMotion() || !element.animate) return;
    if (previous.width && width && previous.width !== width) {
      layout.current.animation = element.animate(
        [{ scale: `${previous.width / width} 1` }, { scale: "1 1" }],
        { duration: DUR.spring, easing: EASE.springSnappy },
      );
    }
    if (toast?.tone === "error") {
      element.animate(
        [{ translate: "6px" }, { translate: "0px" }],
        { duration: DUR.page, easing: EASE.springBouncy },
      );
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-[120] flex justify-center px-5">
      <div
        className="motion-toast rounded-full border border-white/20 bg-[#1a1c1e]/72 px-4 py-2 text-sm font-bold text-white shadow-2xl shadow-slate-900/15 backdrop-blur-2xl"
        data-leaving={leaving || undefined}
        onTransitionEnd={(event) => {
          if (leaving && event.target === event.currentTarget && event.propertyName === "opacity") {
            if (timer.current !== null) clearTimeout(timer.current);
            setToast(null);
          }
        }}
        ref={surface}
        role="status"
      >
        {toast.previous && toast.previous !== toast.message && (
          <span aria-hidden="true" className="toast-old" key={`old-${toast.id}`}>{toast.previous}</span>
        )}
        <span className={toast.previous ? "toast-new" : undefined} key={toast.id}>{toast.message}</span>
      </div>
    </div>
  );
}
