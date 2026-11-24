"use client";

import { DialogSheetHandle, DialogShell, useDialogMotion } from "@/components/dialog-shell";
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
  variant?: "center" | "sheet";
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
  variant,
  zIndex = "z-[130]",
}: ConfirmDialogProps) {
  const t = useT();

  const dialog = useDialogMotion(onCancel);

  return (
    <DialogShell
      {...dialog}
      aria-label={title}
      backdropClassName="bg-[#1a1c1e]/20 backdrop-blur-sm"
      className={`fixed inset-0 ${zIndex} grid place-items-center px-5`}
      closeOnBackdrop={false}
      variant={variant}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className="dialog-panel w-full max-w-sm rounded-[2rem] border border-white/60 bg-white/85 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl">
        {variant === "sheet" && <DialogSheetHandle {...dialog} />}
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
            onClick={dialog.requestClose}
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
    </DialogShell>
  );
}
