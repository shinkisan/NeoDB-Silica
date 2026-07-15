"use client";

import { lazy, Suspense, useContext, useState } from "react";
import { useT } from "@/components/use-t";
import { I18nContext } from "@/components/i18n-provider";

type ReleaseData = {
  date?: string;
  version: string;
  "zh-Hans"?: { body: string; title: string };
  "zh-Hant"?: { body: string; title: string };
  en?: { body: string; title: string };
};

const DEFAULT_LOCALE = "zh-Hans";
const LazyProfileReaderDialog = lazy(() =>
  import("./profile-reader-dialog").then((module) => ({
    default: module.ProfileReaderDialog,
  })),
);

export function ChangelogButton() {
  const t = useT();
  const { locale } = useContext(I18nContext);
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  function open() {
    setIsOpen(true);

    if (release) {
      return;
    }

    fetch("/release.json")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as ReleaseData;
      })
      .then((data) => {
        if (data) {
          setRelease(data);
        }
      })
      .catch(() => {
        setIsOpen(false);
      });
  }

  const title =
    release
      ? (release as unknown as Record<string, { title: string }>)[locale]?.title ||
        release[DEFAULT_LOCALE]?.title ||
        ""
      : t("profile.changelog");

  const body =
    release
      ? (release as unknown as Record<string, { body: string }>)[locale]?.body ||
        release[DEFAULT_LOCALE]?.body ||
        ""
      : "";

  function closeReader() {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 160);
  }

  return (
    <>
      <button
        className="flex w-full items-center justify-between border-b-2 border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
        onClick={open}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef0ea] text-[#364046]">
            <ChangelogIcon />
          </span>
          <span className="truncate text-base font-semibold text-[var(--foreground)]">
            {t("profile.changelog")}
          </span>
        </div>
        <ChevronRightIcon />
      </button>

      {isOpen ? (
        <Suspense fallback={null}>
          <LazyProfileReaderDialog
            body={body}
            isClosing={isClosing}
            isLoading={!release}
            onClose={closeReader}
            title={title}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-[#75777d]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChangelogIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h2" />
    </svg>
  );
}
