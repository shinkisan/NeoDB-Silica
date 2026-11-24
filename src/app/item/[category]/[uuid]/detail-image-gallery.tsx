"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { DialogShell, useDialogMotion } from "@/components/dialog-shell";
import { useT } from "@/components/use-t";
import { prefersReducedMotion, rubberBand } from "@/lib/motion";
import { MediaLoadingIndicator } from "./media-loading-indicator";
import { setDetailMediaOverlayState } from "./detail-media-overlay-state";

type GalleryGesture = {
  axis: "x" | "y" | null;
  id: number;
  x: number;
  y: number;
  lastPosition: number;
  lastTime: number;
  velocity: number;
};

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
  const dialog = useDialogMotion(onClose);
  const gesture = useRef<GalleryGesture | null>(null);

  useEffect(() => {
    setDetailMediaOverlayState(true);
    return () => setDetailMediaOverlayState(false);
  }, []);

  function goTo(nextIndex: number) {
    if (dialog.leaving) return;
    setIndex(Math.max(0, Math.min(images.length - 1, nextIndex)));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (dialog.leaving || !event.isPrimary || event.button !== 0 || gesture.current) return;
    gesture.current = {
      axis: null,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastPosition: 0,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId || dialog.leaving) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const viewport = event.currentTarget;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    const position = drag.axis === "x" ? dx : dy;
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (position - drag.lastPosition) / elapsed;
    drag.lastPosition = position;
    drag.lastTime = event.timeStamp;

    if (prefersReducedMotion()) return;

    viewport.dataset.dragging = "";
    if (drag.axis === "x") {
      const width = viewport.clientWidth;
      const atEdge = dx > 0 ? index === 0 : index === images.length - 1;
      const offset = atEdge ? rubberBand(dx, width * 0.25) : dx;
      viewport.style.setProperty("--gallery-drag-x", `${offset}px`);
    } else {
      const offset = Math.max(0, dy);
      viewport.style.setProperty("--gallery-drag-y", `${offset}px`);
      viewport.style.setProperty("--gallery-shade", String(Math.max(0.25, 1 - offset / (viewport.clientHeight * 0.55))));
    }
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;

    const viewport = event.currentTarget;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const velocity = event.timeStamp - drag.lastTime < 90 ? drag.velocity : 0;
    const dismiss = !cancelled && !dialog.leaving && drag.axis === "y" &&
      (dy >= Math.min(140, viewport.clientHeight * 0.2) || (dy > 32 && velocity > 0.55));

    delete viewport.dataset.dragging;
    viewport.style.removeProperty("--gallery-drag-x");
    viewport.style.removeProperty("--gallery-shade");

    if (dismiss) {
      viewport.style.setProperty("--gallery-dismiss-y", `${Math.max(viewport.clientHeight * 0.35, dy + 40)}px`);
      dialog.requestClose();
    }

    viewport.style.removeProperty("--gallery-drag-y");
    if (!cancelled && drag.axis === "x" &&
      (Math.abs(dx) >= Math.min(120, viewport.clientWidth * 0.24) ||
        (Math.abs(dx) > 24 && velocity * Math.sign(dx) > 0.55))) {
      goTo(index + (dx < 0 ? 1 : -1));
    }
  }

  return (
    <DialogShell
      {...dialog}
      aria-label={alt}
      backdropClassName=""
      className="detail-gallery fixed inset-0 z-[100] overflow-hidden"
      closeOnBackdrop={false}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          goTo(index + (event.key === "ArrowLeft" ? -1 : 1));
        }
      }}
    >
      <button
        aria-label={t("detail.stills.close")}
        className="fixed right-5 top-5 z-[101] grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        onClick={dialog.requestClose}
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
        className="gallery-viewport absolute inset-0 touch-none select-none overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishGesture(event)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget) finishGesture(event, true);
        }}
      >
        <div aria-hidden="true" className="gallery-backdrop absolute inset-0 bg-black/95" />
        <div className="gallery-frame absolute inset-0">
          <div
            className="gallery-track absolute inset-0"
            style={{ "--gallery-page": `${-index * 100}%` } as CSSProperties}
          >
            {images.map((image, slide) => Math.abs(slide - index) <= 1 && (
              <GallerySlide
                active={slide === index}
                alt={alt}
                image={image}
                key={`${slide}:${image.url}`}
                loadingLabel={t("detail.stills.loading")}
                position={slide}
              />
            ))}
          </div>
        </div>
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
    </DialogShell>
  );
}

function GallerySlide({
  active, alt, image, loadingLabel, position,
}: {
  active: boolean;
  alt: string;
  image: GalleryImage;
  loadingLabel: string;
  position: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      aria-hidden={!active}
      className="absolute inset-y-0 flex w-full items-center justify-center p-4"
      style={{ left: `${position * 100}%` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className={`max-h-full max-w-full object-contain ${loaded ? "" : "opacity-0"}`}
        draggable={false}
        onError={() => setLoaded(true)}
        onLoad={() => setLoaded(true)}
        ref={(element) => { if (element?.complete) setLoaded(true); }}
        src={image.url}
      />
      {active && !loaded ? <MediaLoadingIndicator label={loadingLabel} /> : null}
    </div>
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
