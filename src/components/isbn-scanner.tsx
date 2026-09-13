"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import { createIsbnBarcodeDetector } from "@/lib/isbn-barcode-detector";
import { normalizeIsbn } from "@/lib/isbn";

type IsbnScannerButtonProps = {
  defaultOpen?: boolean;
  onClose?: () => void;
  onDetected: (isbn: string) => void;
};

export function IsbnScannerButton({
  defaultOpen = false,
  onClose,
  onDetected,
}: IsbnScannerButtonProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  function closeScanner() {
    setIsOpen(false);
    onClose?.();
  }

  return (
    <>
      <button
        aria-label={t("search.isbnScanner.open")}
        className="grid size-10 shrink-0 place-items-center rounded-full text-[#44474c] transition hover:bg-white/60 hover:text-[#333e50] active:scale-95"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <ScanIcon />
      </button>
      {isOpen ? (
        <IsbnScannerDialog
          onClose={closeScanner}
          onDetected={(isbn) => {
            closeScanner();
            onDetected(isbn);
          }}
        />
      ) : null}
    </>
  );
}

function IsbnScannerDialog({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (isbn: string) => void;
}) {
  const t = useT();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [status, setStatus] = useState<"starting" | "scanning" | "error">(
    "starting",
  );
  const [error, setError] = useState("");
  const isDoneRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError(t("search.isbnScanner.cameraUnavailable"));
        return;
      }

      const detectorResultPromise = createIsbnBarcodeDetector().then(
        (detector) => ({ detector, error: null }),
        (error: unknown) => ({ detector: null, error }),
      );

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
          },
        });

        if (cancelled) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detectorResult = await detectorResultPromise;

        if (detectorResult.error || !detectorResult.detector) {
          console.error(
            "[isbn scanner] barcode decoder failed to load",
            detectorResult.error,
          );
          stopStream(stream);
          streamRef.current = null;
          setStatus("error");
          setError(t("search.isbnScanner.error"));
          return;
        }

        const detector = detectorResult.detector;

        setStatus("scanning");

        async function scanFrame() {
          if (cancelled || isDoneRef.current) {
            return;
          }

          const video = videoRef.current;

          if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            let barcodes;

            try {
              barcodes = await detector.detect(video);
            } catch (detectionError) {
              console.error("[isbn scanner] detection failed", detectionError);
              stopStream(streamRef.current);
              streamRef.current = null;
              setStatus("error");
              setError(t("search.isbnScanner.error"));
              return;
            }

            for (const barcode of barcodes) {
              const isbn = normalizeIsbn(barcode.rawValue);

              if (isbn) {
                isDoneRef.current = true;
                showToast(t("search.isbnScanner.detected"));
                onDetected(isbn);
                return;
              }
            }
          }

          frame = window.setTimeout(scanFrame, 180);
        }

        void scanFrame();
      } catch (scanError) {
        if (!cancelled) {
          console.error("[isbn scanner] camera failed", scanError);
          setStatus("error");
          setError(t("search.isbnScanner.permissionError"));
        }
      }
    }

    void startScanner();

    function handleVisibilityChange() {
      if (document.hidden) {
        onClose();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(frame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [onClose, onDetected, t]);

  if (!isHydrated) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#1a1c1e]/45 px-5 py-5 backdrop-blur-sm">
      <section className="review-editor-enter flex max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl">
        <header className="flex items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              {t("search.isbnScanner.title")}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-[#75777d]">
              {t("search.isbnScanner.description")}
            </p>
          </div>
          <button
            aria-label={t("search.isbnScanner.close")}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="relative mt-2 aspect-[3/4] overflow-hidden rounded-[1.5rem] border border-white/60 bg-[#1a1c1e] shadow-inner sm:aspect-[4/3]">
          <video
            className="h-full w-full object-cover"
            muted
            playsInline
            ref={videoRef}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/25"
              style={{
                mask:
                  "linear-gradient(#000 0 0) center / min(16rem, 78%) 7rem no-repeat exclude, linear-gradient(#000 0 0)",
                WebkitMask:
                  "linear-gradient(#000 0 0) center / min(16rem, 78%) 7rem no-repeat, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
              }}
            />
            <div className="relative h-28 w-64 max-w-[78%] rounded-2xl border-2 border-white/85" />
          </div>
          {status !== "scanning" ? (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/85 px-4 py-3 text-sm font-semibold leading-6 text-[#333e50] backdrop-blur">
              {status === "starting"
                ? t("search.isbnScanner.starting")
                : error || t("search.isbnScanner.error")}
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function subscribeToHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function ScanIcon() {
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
      <path d="M7 3H5a2 2 0 0 0-2 2v2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M17 21h2a2 2 0 0 0 2-2v-2" />
      <path d="M7.5 8v8" />
      <path d="M10.5 8v8" />
      <path d="M13.5 8v8" />
      <path d="M16.5 8v8" />
    </svg>
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
