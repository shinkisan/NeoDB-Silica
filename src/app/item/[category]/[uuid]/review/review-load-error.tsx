"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/use-t";
import {
  DETAIL_EDITOR_RETURN_PREFIX,
  DETAIL_RESTORE_PREFIX,
} from "../detail-state";

type ReviewLoadErrorProps = {
  category: string;
  itemUuid: string;
};

export function ReviewLoadError({
  category,
  itemUuid,
}: ReviewLoadErrorProps) {
  const router = useRouter();
  const t = useT();

  function close() {
    window.sessionStorage.setItem(`${DETAIL_RESTORE_PREFIX}${itemUuid}`, "1");

    const returnKey = `${DETAIL_EDITOR_RETURN_PREFIX}${itemUuid}`;
    const storedPath = window.sessionStorage.getItem(returnKey);

    if (
      window.history.length > 1 &&
      isValidDetailReturnPath(storedPath, category, itemUuid)
    ) {
      window.sessionStorage.removeItem(returnKey);
      router.back();
      return;
    }

    window.sessionStorage.removeItem(returnKey);
    router.replace(`/item/${category}/${encodeURIComponent(itemUuid)}`);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center">
          <button
            aria-label={t("reviewEditor.exit")}
            className="grid size-10 place-items-center rounded-full text-[#75777d] transition hover:bg-white/60 hover:text-[#333e50] active:scale-95"
            onClick={close}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <section className="mx-auto grid min-h-screen max-w-4xl place-items-center px-5 py-24">
        <div className="flex max-w-sm flex-col items-center text-center">
          <p className="text-sm font-bold text-[var(--foreground)]">
            {t("reviewEditor.loadError")}
          </p>
          <button
            className="mt-5 rounded-full bg-[var(--theme-primary)] px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-95"
            onClick={() => router.refresh()}
            type="button"
          >
            {t("reviewEditor.retry")}
          </button>
        </div>
      </section>
    </main>
  );
}

function isValidDetailReturnPath(
  path: string | null,
  category: string,
  itemUuid: string,
) {
  if (!path) {
    return false;
  }

  const detailPath = `/item/${category}/${encodeURIComponent(itemUuid)}`;
  return path === detailPath || path.startsWith(`${detailPath}?`);
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
