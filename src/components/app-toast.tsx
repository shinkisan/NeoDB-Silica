"use client";

import { useEffect, useRef, useState } from "react";

type ToastTone = "error" | "success";

type ToastPayload = {
  message: string;
  tone?: ToastTone;
};

const TOAST_EVENT_NAME = "bielu:toast";

export function showToast(message: string, tone: ToastTone = "success") {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, {
      detail: { message, tone },
    }),
  );
}

export function AppToast() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function handleToast(event: Event) {
      const payload = (event as CustomEvent<ToastPayload>).detail;

      if (!payload?.message) {
        return;
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      setToast({
        message: payload.message,
        tone: payload.tone || "success",
      });
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, 1800);
    }

    window.addEventListener(TOAST_EVENT_NAME, handleToast);

    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, handleToast);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-[120] flex justify-center px-5">
      <div
        className="rounded-full border border-white/20 bg-[#1a1c1e]/72 px-4 py-2 text-sm font-bold text-white shadow-2xl shadow-slate-900/15 backdrop-blur-2xl"
        role="status"
      >
        {toast.message}
      </div>
    </div>
  );
}
