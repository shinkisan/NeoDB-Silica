"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useT } from "@/components/use-t";
import type { TmdbStillImage } from "@/lib/tmdb";
import { useDetailCover } from "./detail-cover-state";
import { setDetailMediaOverlayState } from "./detail-media-overlay-state";

const LazyDetailImageGallery = lazy(() =>
  import("./detail-image-gallery").then((module) => ({
    default: module.DetailImageGallery,
  })),
);
const LazySpotifyAlbumPlayer = lazy(() =>
  import("./spotify-album-player").then((module) => ({
    default: module.SpotifyAlbumPlayer,
  })),
);
const LazySteamTrailerPlayer = lazy(() =>
  import("./steam-trailer-player").then((module) => ({
    default: module.SteamTrailerPlayer,
  })),
);

type ImageViewerProps = {
  alt: string;
  showLoadingSkeleton?: boolean;
  spotifyAlbumUrl?: string | null;
  src: string;
  steamAppId?: string | null;
  steamLocale?: "en" | "zh-Hans" | "zh-Hant";
  stills?: TmdbStillImage[] | null;
};

export function ImageViewer({
  alt,
  showLoadingSkeleton = false,
  spotifyAlbumUrl,
  src,
  steamAppId,
  steamLocale,
  stills,
}: ImageViewerProps) {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isSpotifyOpen, setIsSpotifyOpen] = useState(false);
  const [isSteamTrailerOpen, setIsSteamTrailerOpen] = useState(false);
  const { currentSrc, switchToFallback } = useDetailCover(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const loadState =
    loadedSrc === currentSrc
      ? "loaded"
      : failedSrc === currentSrc
        ? "failed"
        : "loading";

  useEffect(() => {
    return () => {
      setDetailMediaOverlayState(false);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = imageRef.current;

    if (!image?.complete) {
      return;
    }

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (image.naturalWidth > 0) {
        setLoadedSrc(currentSrc);
      } else if (!switchToFallback()) {
        setFailedSrc(currentSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentSrc, switchToFallback]);

  function handleImageError() {
    if (!switchToFallback()) {
      setFailedSrc(currentSrc);
    }
  }

  return (
    <>
      <button
        aria-label="查看大图"
        className="relative h-full w-full overflow-hidden"
        disabled={loadState !== "loaded"}
        onClick={() => setOpenIndex(0)}
        type="button"
      >
        {showLoadingSkeleton && loadState === "loading" ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-pulse bg-[#e2e2e5] motion-reduce:animate-none"
            data-detail-poster-skeleton
          />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className={`h-full w-full object-cover transition-opacity duration-150 motion-reduce:transition-none ${
            loadState === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          data-detail-poster-image
          key={currentSrc}
          onError={handleImageError}
          onLoad={() => setLoadedSrc(currentSrc)}
          ref={imageRef}
          src={currentSrc}
        />
        {loadState === "failed" ? (
          <span className="absolute inset-0 flex items-center justify-center p-8 text-center text-lg font-semibold text-[#75777d]">
            {alt}
          </span>
        ) : null}
      </button>

      {spotifyAlbumUrl || steamAppId || (stills && stills.length > 0) ? (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
          {spotifyAlbumUrl ? (
            <button
              aria-label={t("detail.spotify.open")}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-95"
              onClick={() => setIsSpotifyOpen(true)}
              title={t("detail.spotify.open")}
              type="button"
            >
              <PlayIcon />
            </button>
          ) : null}
          {steamAppId ? (
            <button
              aria-label={t("detail.steam.open")}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-95"
              onClick={() => setIsSteamTrailerOpen(true)}
              title={t("detail.steam.open")}
              type="button"
            >
              <PlayIcon />
            </button>
          ) : null}
          {stills && stills.length > 0 ? (
            <button
              aria-label={t("detail.stills.badgeLabel")}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-95"
              onClick={() => setOpenIndex(1)}
              type="button"
            >
              <GalleryIcon />
              {stills.length}
            </button>
          ) : null}
        </div>
      ) : null}

      {openIndex !== null ? (
        <Suspense fallback={null}>
          <LazyDetailImageGallery
            alt={alt}
            images={[{ url: currentSrc }, ...(stills || [])]}
            initialIndex={openIndex}
            onClose={() => setOpenIndex(null)}
          />
        </Suspense>
      ) : null}

      {isSpotifyOpen && spotifyAlbumUrl ? (
        <Suspense fallback={null}>
          <LazySpotifyAlbumPlayer
            albumTitle={alt}
            embedUrl={spotifyAlbumUrl}
            onClose={() => setIsSpotifyOpen(false)}
          />
        </Suspense>
      ) : null}

      {isSteamTrailerOpen && steamAppId && steamLocale ? (
        <Suspense fallback={null}>
          <LazySteamTrailerPlayer
            appId={steamAppId}
            gameTitle={alt}
            locale={steamLocale}
            onClose={() => setIsSteamTrailerOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 translate-x-px"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M8 5.8a1 1 0 0 1 1.52-.85l9 6.2a1 1 0 0 1 0 1.7l-9 6.2A1 1 0 0 1 8 18.2V5.8Z" />
    </svg>
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
