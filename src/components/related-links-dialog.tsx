"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";

export type RelatedLink = {
  href: string;
  iconPath: string;
  label: string;
};

export function RelatedLinksDialog({
  closeLabel,
  links,
  onClose,
  title,
}: {
  closeLabel?: string;
  links: RelatedLink[];
  onClose: () => void;
  title: string;
}) {
  const t = useT();
  const resolvedCloseLabel = closeLabel || t("detail.tools.closeRelatedLinks");

  useLockedBodyScroll();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <section
        className="review-editor-enter flex max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 pb-2">
          <h2 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
            {title}
          </h2>
          <button
            aria-label={resolvedCloseLabel}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="mt-2 max-h-[min(24rem,calc(100dvh_-_10rem_-_env(safe-area-inset-bottom)))] overflow-y-auto overscroll-contain rounded-2xl border border-white/60 bg-white/45">
          {links.map((link) => (
            <a
              className="flex min-w-0 cursor-pointer items-center justify-between gap-4 border-b-2 border-[#c5c6cd]/30 p-4 text-left transition last:border-0 hover:bg-white/45"
              href={link.href}
              key={link.href}
              rel="noreferrer"
              target="_blank"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f7f8fb] shadow-sm shadow-slate-900/5">
                  <span
                    aria-hidden="true"
                    className="size-5 bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('${link.iconPath}')` }}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[var(--foreground)]">
                    {link.label}
                  </p>
                </div>
              </div>
              <ExternalLinkMenuIcon />
            </a>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function useLockedBodyScroll() {
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
}

export function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
