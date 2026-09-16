"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";
import { setDetailMediaOverlayState } from "./detail-media-overlay-state";
import { MediaLoadingIndicator } from "./media-loading-indicator";

type SpotifyAlbumPlayerProps = {
  albumTitle: string;
  embedUrl: string;
  onClose: () => void;
};

export function SpotifyAlbumPlayer({
  albumTitle,
  embedUrl,
  onClose,
}: SpotifyAlbumPlayerProps) {
  const t = useT();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setDetailMediaOverlayState(true);
    closeButtonRef.current?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousOverscrollBehavior =
      document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      setDetailMediaOverlayState(false);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.documentElement.style.overscrollBehavior =
        previousOverscrollBehavior;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <section
      aria-label={t("detail.spotify.title")}
      aria-modal="true"
      className="image-viewer-enter fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/95 p-4 pt-20"
      role="dialog"
    >
      <button
        aria-label={t("detail.spotify.close")}
        className="fixed right-5 top-5 z-[102] grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 press-icon"
        onClick={onClose}
        ref={closeButtonRef}
        type="button"
      >
        <CloseIcon />
      </button>

      <div className="relative h-[min(78dvh,680px)] min-h-[352px] w-full max-w-xl overflow-hidden rounded-xl bg-[#181818] shadow-2xl shadow-black/40">
        {isLoaded ? null : (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-[#282828] motion-reduce:animate-none"
            />
            <MediaLoadingIndicator label={t("detail.spotify.loading")} />
          </>
        )}
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className={`relative h-full w-full border-0 transition-opacity duration-200 motion-reduce:transition-none ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          src={embedUrl}
          title={t("detail.spotify.iframeTitle").replace("{title}", albumTitle)}
        />
      </div>
    </section>,
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
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
