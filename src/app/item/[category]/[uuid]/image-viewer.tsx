"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { useT } from "@/components/use-t";
import type { TmdbStillImage } from "@/lib/tmdb";

const LazyDetailImageGallery = lazy(() =>
  import("./detail-image-gallery").then((module) => ({
    default: module.DetailImageGallery,
  })),
);

type ImageViewerProps = {
  alt: string;
  src: string;
  stills?: TmdbStillImage[] | null;
};

export function ImageViewer({ alt, src, stills }: ImageViewerProps) {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      setImageViewerState(false);
    };
  }, []);

  return (
    <>
      <button
        aria-label="查看大图"
        className="h-full w-full"
        onClick={() => setOpenIndex(0)}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt} className="h-full w-full object-cover" src={src} />
      </button>

      {stills && stills.length > 0 ? (
        <button
          aria-label={t("detail.stills.badgeLabel")}
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-95"
          onClick={() => setOpenIndex(1)}
          type="button"
        >
          <GalleryIcon />
          {stills.length}
        </button>
      ) : null}

      {openIndex !== null ? (
        <Suspense fallback={null}>
          <LazyDetailImageGallery
            alt={alt}
            images={[{ url: src }, ...(stills || [])]}
            initialIndex={openIndex}
            onClose={() => setOpenIndex(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export function setImageViewerState(isOpen: boolean) {
  document.documentElement.dataset.imageViewerOpen = isOpen ? "true" : "false";
  window.dispatchEvent(
    new CustomEvent("app:image-viewer", { detail: isOpen }),
  );
}

function GalleryIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect x="7" y="7" width="13" height="13" rx="2" />
      <path d="M4 16V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
