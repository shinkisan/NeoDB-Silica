"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import { setDetailMediaOverlayState } from "./detail-media-overlay-state";
import { MediaLoadingIndicator } from "./media-loading-indicator";

type SteamTrailerPlayerProps = {
  appId: string;
  gameTitle: string;
  locale: "en" | "zh-Hans" | "zh-Hant";
  onClose: () => void;
};

type TrailerResponse = {
  posterUrl?: string | null;
  streamUrl?: string;
};

export function SteamTrailerPlayer({
  appId,
  gameTitle,
  locale,
  onClose,
}: SteamTrailerPlayerProps) {
  const t = useT();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterUrl, setPosterUrl] = useState<string | undefined>();
  const [isReady, setIsReady] = useState(false);

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

  useEffect(() => {
    const controller = new AbortController();
    const video = videoRef.current;
    let disposed = false;
    let destroyHls: (() => void) | undefined;

    async function loadTrailer() {
      try {
        const response = await fetch(
          `/api/steam/trailer?appId=${encodeURIComponent(appId)}&locale=${encodeURIComponent(locale)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Steam trailer request failed: ${response.status}`);
        }

        const payload = (await response.json()) as TrailerResponse;
        const streamUrl = payload.streamUrl;
        if (disposed || !video || !streamUrl) {
          throw new Error("Steam trailer response was incomplete");
        }

        setPosterUrl(payload.posterUrl || undefined);

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
          return;
        }

        const { default: Hls } = await import("hls.js");

        if (disposed) {
          return;
        }

        if (!Hls.isSupported()) {
          throw new Error("HLS playback is not supported");
        }

        const hls = new Hls({ enableWorker: true });
        destroyHls = () => hls.destroy();
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !disposed) {
            console.error("[steam trailer] playback failed", data);
            showToast(t("detail.steam.unavailable"), "error");
            onClose();
          }
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      } catch (error) {
        if (controller.signal.aborted || disposed) {
          return;
        }

        console.error("[steam trailer] load failed", error);
        showToast(t("detail.steam.unavailable"), "error");
        onClose();
      }
    }

    void loadTrailer();

    return () => {
      disposed = true;
      controller.abort();
      destroyHls?.();

      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [appId, locale, onClose, t]);

  return createPortal(
    <section
      aria-label={t("detail.steam.title")}
      aria-modal="true"
      className="image-viewer-enter fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/95"
      role="dialog"
    >
      <button
        aria-label={t("detail.steam.close")}
        className="fixed right-5 top-5 z-[102] grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 press-icon"
        onClick={onClose}
        ref={closeButtonRef}
        type="button"
      >
        <CloseIcon />
      </button>

      {isReady ? null : (
        <MediaLoadingIndicator label={t("detail.steam.loading")} />
      )}
      <video
        aria-label={t("detail.steam.videoLabel").replace("{title}", gameTitle)}
        autoPlay
        className={`relative h-full w-full object-contain transition-opacity duration-200 motion-reduce:transition-none ${
          isReady ? "opacity-100" : "opacity-0"
        }`}
        controls
        onCanPlay={() => setIsReady(true)}
        onError={() => {
          if (videoRef.current?.getAttribute("src")) {
            console.error("[steam trailer] native playback failed");
            showToast(t("detail.steam.unavailable"), "error");
            onClose();
          }
        }}
        playsInline
        poster={posterUrl}
        preload="metadata"
        ref={videoRef}
      />
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
