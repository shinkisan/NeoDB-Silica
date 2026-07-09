"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";
import { setImageViewerState } from "./image-viewer";

const SWIPE_THRESHOLD_PX = 48;

export type GalleryImage = {
  url: string;
};

type DetailImageGalleryProps = {
  alt: string;
  images: GalleryImage[];
  initialIndex: number;
  onClose: () => void;
};

export function DetailImageGallery({
  alt,
  images,
  initialIndex,
  onClose,
}: DetailImageGalleryProps) {
  const t = useT();
  const [index, setIndex] = useState(initialIndex);
  const [isClosing, setIsClosing] = useState(false);
  const gestureStartRef = useRef<{ id: number; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    setImageViewerState(true);

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousRootOverscrollBehavior =
      document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      setImageViewerState(false);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      document.documentElement.style.overflow = previousRootOverflow;
      document.documentElement.style.overscrollBehavior =
        previousRootOverscrollBehavior;
    };
  }, []);

  function closeGallery() {
    setIsClosing(true);
    window.setTimeout(onClose, 180);
  }

  function goTo(nextIndex: number) {
    setIndex(Math.max(0, Math.min(images.length - 1, nextIndex)));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) {
      return;
    }

    gestureStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gestureStartRef.current;

    if (!start || start.id !== event.pointerId) {
      return;
    }

    gestureStartRef.current = null;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < SWIPE_THRESHOLD_PX || absX < absY * 1.35) {
      return;
    }

    goTo(deltaX < 0 ? index + 1 : index - 1);
  }

  const current = images[index];

  return createPortal(
    <div
      className={`fixed left-0 top-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-black/95 ${
        isClosing ? "image-viewer-exit" : "image-viewer-enter"
      }`}
    >
      <button
        aria-label={t("detail.stills.close")}
        className="fixed right-5 top-5 z-[101] grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        onClick={closeGallery}
        type="button"
      >
        <CloseIcon />
      </button>

      {images.length > 1 ? (
        <div className="fixed left-1/2 top-5 z-[101] -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {index + 1} / {images.length}
        </div>
      ) : null}

      <div
        className="flex h-[100dvh] w-screen touch-none select-none items-center justify-center overflow-hidden p-4"
        onPointerCancel={() => {
          gestureStartRef.current = null;
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={alt}
            className="max-h-full max-w-full object-contain"
            draggable={false}
            key={current.url}
            src={current.url}
          />
        ) : null}
      </div>

      {index > 0 ? (
        <button
          aria-label={t("detail.stills.previous")}
          className="fixed left-3 top-1/2 z-[101] hidden -translate-y-1/2 place-items-center rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25 sm:grid"
          onClick={() => goTo(index - 1)}
          type="button"
        >
          <ChevronIcon direction="left" />
        </button>
      ) : null}

      {index < images.length - 1 ? (
        <button
          aria-label={t("detail.stills.next")}
          className="fixed right-3 top-1/2 z-[101] hidden -translate-y-1/2 place-items-center rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25 sm:grid"
          onClick={() => goTo(index + 1)}
          type="button"
        >
          <ChevronIcon direction="right" />
        </button>
      ) : null}
    </div>,
    document.body,
  );
}

function CloseIcon() {
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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
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
      {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}
