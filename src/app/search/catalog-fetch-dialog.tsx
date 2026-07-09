"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { parseCatalogDetailPath, parseNeodbDetailPath } from "@/lib/catalog-link";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";

type CatalogFetchDialogProps = {
  initialUrl?: string;
  initialPhase?: FetchPhase;
  initialMessage?: string;
  skipForm?: boolean;
  onClose: () => void;
  onResolved?: (detailPath: string) => void;
};

type FetchPhase = "form" | "working" | "success" | "error";

type CatalogFetchPayload = {
  detailPath?: string;
  message: string | null;
  url?: string;
};

const POLL_INTERVAL_MS = 15_000;
const FETCH_TIMEOUT_MS = 120_000;
const MIN_POLL_INTERVAL_MS = 1_000;

const SUPPORTED_LINK_HOSTS = [
  "archiveofourown.org",
  "bandcamp.com",
  "bgm.tv",
  "bibliotek.dk",
  "boardgamegeek.com",
  "books.com.tw",
  "imdb.com",
  "igdb.com",
  "itch.io",
  "jjwxc.net",
  "douban.com",
  "goodreads.com",
  "musicbrainz.org",
  "mobygames.com",
  "music.apple.com",
  "music.youtube.com",
  "openlibrary.org",
  "podcasts.apple.com",
  "qidian.com",
  "discogs.com",
  "google.com",
  "google.co.jp",
  "google.co.uk",
  "google.com.hk",
  "google.com.tw",
  "rss.com",
  "spotify.com",
  "thestorygraph.com",
  "themoviedb.org",
  "tmdb.org",
  "letterboxd.com",
  "bangumi.tv",
  "store.steampowered.com",
  "steamcommunity.com",
  "wikidata.org",
  "worldcat.org",
  "ypshuo.com",
];

if (process.env.NODE_ENV !== "production") {
  SUPPORTED_LINK_HOSTS.push("mock.bielu.local");
}

export function isSupportedCatalogLink(value: string) {
  const parsed = parseUrl(value);

  if (!parsed) {
    return false;
  }

  if (parseNeodbDetailPath(parsed.href)) {
    return true;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  return SUPPORTED_LINK_HOSTS.some(
    (supportedHost) => host === supportedHost || host.endsWith(`.${supportedHost}`),
  );
}

export function SearchCatalogPrompt({ initialUrl }: { initialUrl?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const defaultUrl = initialUrl && isValidCatalogUrl(initialUrl) ? initialUrl : "";

  return (
    <>
      <button
        className="mx-auto mt-4 block cursor-pointer text-center text-sm font-semibold text-[#75777d] transition active:scale-[0.99]"
        onClick={() => setOpen(true)}
        type="button"
      >
        {t("search.catalogFetch.promptPrefix")}
        <span className="text-[#2563eb] hover:underline">
          {t("search.catalogFetch.promptAction")}
        </span>
        {t("search.catalogFetch.promptSuffix")}
      </button>
      {open ? (
        <CatalogFetchDialog
          initialUrl={defaultUrl}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function CatalogFetchDialog({
  initialUrl = "",
  initialPhase = "form",
  initialMessage = "",
  skipForm = false,
  onClose,
  onResolved,
}: CatalogFetchDialogProps) {
  const t = useT();
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [phase, setPhase] = useState<FetchPhase>(initialPhase || "form");
  const [message, setMessage] = useState(initialMessage || "");
  const [hasErrorMessage, setHasErrorMessage] = useState(false);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      closedRef.current = true;

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (!skipForm || phase !== "working" || !initialUrl) {
      return;
    }

    startedAtRef.current = Date.now();
    void requestCatalogFetch(initialUrl);
    // The dialog may be opened after a silent preflight returned 202. Check once
    // immediately so a quickly completed fetch can resolve without waiting; if
    // NeoDB replies with 202 or 429, later checks are throttled by the poll loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeDialog() {
    closedRef.current = true;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    onClose();
  }

  async function startFetch() {
    const trimmedUrl = url.trim();
    const detailPath = parseNeodbDetailPath(trimmedUrl);

    if (detailPath) {
      navigateToDetail(detailPath);
      return;
    }

    if (!isValidCatalogUrl(trimmedUrl)) {
      setMessage(t("search.catalogFetch.unsupported"));
      return;
    }

    startedAtRef.current = Date.now();
    setPhase("working");
    setHasErrorMessage(false);
    setMessage(t("search.catalogFetch.workingHint"));
    await requestCatalogFetch(trimmedUrl);
  }

  async function requestCatalogFetch(targetUrl: string) {
    if (closedRef.current) {
      return;
    }

    try {
      const response = await fetch(
        `/api/neodb/catalog-fetch?url=${encodeURIComponent(targetUrl)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | CatalogFetchPayload
        | null;

      if (response.status === 302 && (payload?.detailPath || payload?.url)) {
        const detailPath =
          payload.detailPath || parseCatalogDetailPath(payload.url || "");

        if (detailPath) {
          navigateToDetail(detailPath);
        } else if (payload.url) {
          window.location.href = payload.url;
        } else {
          setPhase("error");
          setMessage(t("search.catalogFetch.error"));
        }

        return;
      }

      if (response.status === 202) {
        scheduleNextCheck(targetUrl);
        return;
      }

      if (response.status === 429 && startedAtRef.current > 0) {
        scheduleNextCheck(targetUrl, getRetryAfterDelay(response));
        return;
      }

      setPhase("error");

      if (response.status === 422) {
        setHasErrorMessage(true);
        setMessage(getCatalogFetchErrorMessage(response.status, payload?.message));
      } else if (response.status === 429) {
        setHasErrorMessage(true);
        setMessage(getCatalogFetchErrorMessage(response.status, payload?.message));
      } else {
        setHasErrorMessage(true);
        setMessage(getCatalogFetchErrorMessage(response.status, payload?.message));
      }
    } catch {
      setPhase("error");
      setHasErrorMessage(true);
      setMessage(t("search.catalogFetch.error"));
    }
  }

  function scheduleNextCheck(targetUrl: string, overrideDelayMs?: number) {
    const elapsed = Date.now() - startedAtRef.current;

    if (elapsed >= FETCH_TIMEOUT_MS) {
      setPhase("error");
      setMessage(t("search.catalogFetch.timeout"));
      return;
    }

    const remaining = Math.max(0, FETCH_TIMEOUT_MS - elapsed);
    const delay = Math.min(
      remaining,
      Math.max(overrideDelayMs || 0, getPollInterval(targetUrl)),
    );

    setMessage(t("search.catalogFetch.workingHint"));
    timerRef.current = window.setTimeout(() => {
      void requestCatalogFetch(targetUrl);
    }, delay);
  }

  function navigateToDetail(href: string) {
    if (closedRef.current) {
      return;
    }

    onResolved?.(href);
    requestDetailScrollTopForHref(href);
    pushNavigationFrame("detail", href);
    router.push(href);
    onClose();
  }

  function getCatalogFetchErrorMessage(
    status: number,
    upstreamMessage?: string | null,
  ) {
    const normalizedMessage = upstreamMessage?.trim().toLowerCase();

    if (
      status === 422 &&
      (!normalizedMessage || normalizedMessage === "unsupported url")
    ) {
      return t("search.catalogFetch.unsupported");
    }

    if (
      status === 429 &&
      (!normalizedMessage || normalizedMessage === "too many requests")
    ) {
      return t("search.catalogFetch.rateLimited");
    }

    if (
      status === 502 &&
      (!normalizedMessage || normalizedMessage === "mock upstream error")
    ) {
      return t("search.catalogFetch.error");
    }

    return upstreamMessage || t("search.catalogFetch.error");
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center bg-[#1a1c1e]/25 px-5 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">
            {phase === "form"
              ? t("search.catalogFetch.title")
              : phase === "success"
                ? t("search.catalogFetch.successTitle")
                : phase === "error"
                  ? t("search.catalogFetch.errorTitle")
                  : t("search.catalogFetch.workingTitle")}
          </h2>
          <button
            aria-label={t("search.catalogFetch.close")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
            onClick={closeDialog}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        {phase === "form" ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[#44474c]">
              {t("search.catalogFetch.description")}
            </p>
            <div className="mt-4 rounded-2xl border border-[#e2e2e5] bg-white/80 p-2">
              <input
                autoFocus
                className="h-11 w-full rounded-xl bg-transparent px-3 text-base text-[#1a1c1e] outline-none placeholder:text-[#8a8d94]"
                onChange={(event) => {
                  setUrl(event.target.value);
                  setMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void startFetch();
                  }
                }}
                placeholder={t("search.catalogFetch.inputPlaceholder")}
                type="url"
                value={url}
              />
            </div>
            {message ? (
              <p className="mt-3 text-sm font-bold text-[#b42318]">{message}</p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-[#75777d]">
              {t("search.catalogFetch.supported")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-full px-4 py-2 text-sm font-bold text-[#44474c] transition hover:bg-white/70"
                onClick={closeDialog}
                type="button"
              >
                {t("search.catalogFetch.cancel")}
              </button>
              <button
                className="rounded-full bg-[var(--theme-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--theme-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!url.trim()}
                onClick={() => void startFetch()}
                type="button"
              >
                {t("search.catalogFetch.start")}
              </button>
            </div>
          </>
        ) : (
          <div className={phase === "error" ? "pt-2" : "py-6 text-center"}>
            {phase === "working" ? <LoopSpinner /> : null}
            {phase === "success" ? (
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--theme-primary)] text-white">
                <CheckIcon />
              </div>
            ) : null}
            {phase !== "error" || hasErrorMessage ? (
              <p
                className={
                  phase === "error"
                    ? "mt-2 text-sm leading-6 text-[#44474c]"
                    : "mt-5 text-base font-bold text-[var(--foreground)]"
                }
              >
                {message}
              </p>
            ) : null}
            {phase === "working" ? (
              <p className="mt-2 text-sm leading-6 text-[#75777d]">
                {t("search.catalogFetch.workingDescription")}
              </p>
            ) : null}
            {phase === "error" ? (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="rounded-full px-4 py-2 text-sm font-bold text-[#44474c] transition hover:bg-white/70"
                  onClick={() => setPhase("form")}
                  type="button"
                >
                  {t("search.catalogFetch.back")}
                </button>
                <button
                  className="rounded-full bg-[var(--theme-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--theme-primary-hover)]"
                  onClick={() => void startFetch()}
                  type="button"
                >
                  {t("search.catalogFetch.retry")}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function parseUrl(value: string) {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function isValidCatalogUrl(value: string) {
  const parsed = parseUrl(value);

  return parsed?.protocol === "http:" || parsed?.protocol === "https:";
}

function getPollInterval(targetUrl: string) {
  const parsed = parseUrl(targetUrl);

  if (parsed?.hostname !== "mock.bielu.local") {
    return POLL_INTERVAL_MS;
  }

  const scenario = parsed.pathname.split("/").filter(Boolean)[1] || "";
  const match = scenario.match(/^pending-(\d{1,3})-then-found$/);

  if (!match) {
    return MIN_POLL_INTERVAL_MS;
  }

  const seconds = Math.max(1, Math.min(120, Number(match[1])));

  return Math.max(MIN_POLL_INTERVAL_MS, Math.min(POLL_INTERVAL_MS, seconds * 250));
}

function getRetryAfterDelay(response: Response) {
  const retryAfter = Number(response.headers.get("Retry-After") || "");

  if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
    return POLL_INTERVAL_MS;
  }

  return Math.min(FETCH_TIMEOUT_MS, retryAfter * 1000);
}

function LoopSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="mx-auto size-16 animate-spin text-[var(--theme-primary)]"
      viewBox="0 0 48 48"
    >
      <circle
        className="opacity-25"
        cx="24"
        cy="24"
        fill="none"
        r="18"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M42 24a18 18 0 0 0-18-18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
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
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}
