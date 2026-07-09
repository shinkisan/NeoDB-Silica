"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/app-toast";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { preservePersonWorksScroll } from "./person-works-scroll";

export function PersonWorkActionCard({
  children,
  searchHref,
  personId,
  tmdbUrl,
}: {
  children: ReactNode;
  searchHref: string;
  personId: string;
  tmdbUrl: string;
}) {
  const t = useT();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    setIsOpen(true);
    setMenuRect(buttonRef.current?.getBoundingClientRect() || null);
  }

  function closeMenu() {
    setIsOpen(false);
  }

  function searchItem() {
    preservePersonWorksScroll(personId);
    pushNavigationFrame("search", searchHref);
    router.push(searchHref);
    closeMenu();
  }

  async function copyTmdbLink() {
    try {
      await navigator.clipboard.writeText(tmdbUrl);
      showToast(t("credits.tmdbCopied"));
    } catch {
      showToast(t("credits.tmdbCopyFailed"), "error");
    } finally {
      closeMenu();
    }
  }

  return (
    <article className="relative rounded-2xl border border-white/70 bg-white/60 shadow-lg shadow-slate-900/5 transition hover:bg-white/75">
      <button
        className="block w-full cursor-pointer p-3 pr-12 text-left transition active:scale-[0.99]"
        onClick={openMenu}
        type="button"
      >
        {children}
      </button>
      <button
        aria-expanded={isOpen}
        aria-label={t("credits.workActions")}
        className="absolute right-3 top-3 grid size-9 cursor-pointer place-items-center rounded-full text-[#75777d] transition hover:bg-white/70 hover:text-[#44474c] active:scale-95"
        onClick={(event) => {
          event.stopPropagation();
          openMenu();
        }}
        ref={buttonRef}
        type="button"
      >
        <DotsIcon />
      </button>
      {isOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                aria-label={t("credits.closeWorkActions")}
                className="fixed inset-0 z-[104] cursor-default"
                onClick={closeMenu}
                type="button"
              />
              <div
                className="fixed z-[105] w-max min-w-40 overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1 shadow-xl shadow-slate-900/10"
                ref={menuRef}
                role="menu"
                style={{
                  left: menuRect.right,
                  top: menuRect.bottom + 4,
                  transform: "translateX(-100%)",
                }}
              >
                <button
                  className="flex h-9 w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-[#44474c] transition hover:bg-[#e2e2e5]/70"
                  onClick={searchItem}
                  role="menuitem"
                  type="button"
                >
                  <SearchIcon />
                  {t("credits.searchItem")}
                </button>
                <button
                  className="flex h-9 w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-[#44474c] transition hover:bg-[#e2e2e5]/70"
                  onClick={() => void copyTmdbLink()}
                  role="menuitem"
                  type="button"
                >
                  <CopyIcon />
                  {t("credits.copyTmdb")}
                </button>
                <a
                  className="flex h-9 w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-[#44474c] transition hover:bg-[#e2e2e5]/70"
                  href={tmdbUrl}
                  onClick={closeMenu}
                  rel="noreferrer"
                  role="menuitem"
                  target="_blank"
                >
                  <ExternalLinkIcon />
                  {t("credits.openTmdb")}
                </a>
              </div>
            </>,
            document.body,
          )
        : null}
    </article>
  );
}

function DotsIcon() {
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
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function SearchIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CopyIcon() {
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
      <rect height="14" rx="2" width="14" x="8" y="8" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ExternalLinkIcon() {
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
