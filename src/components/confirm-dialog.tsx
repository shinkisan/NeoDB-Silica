"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";

type ConfirmDialogProps = {
  cancelLabel?: string;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  description?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  zIndex?: string;
};

export function ConfirmDialog({
  cancelLabel,
  children,
  confirmDisabled = false,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title,
  zIndex = "z-[130]",
}: ConfirmDialogProps) {
  const t = useT();

  useEffect(() => {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 ${zIndex} grid place-items-center bg-[#1a1c1e]/20 px-5 backdrop-blur-sm`}>
      <div className="w-full max-w-sm rounded-[2rem] border border-white/60 bg-white/85 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl">
        <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
        {description ? (
          typeof description === "string" ? (
            <p className="mt-2 text-sm leading-6 text-[#44474c]">{description}</p>
          ) : (
            <div className="mt-2">{description}</div>
          )
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-full px-4 py-2 text-sm font-bold text-[#44474c] transition hover:bg-white/70"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel ?? t("confirmDialog.defaultCancel")}
          </button>
          <button
            className="rounded-full bg-[var(--theme-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--theme-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={confirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel ?? t("confirmDialog.defaultConfirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
