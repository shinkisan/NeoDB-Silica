import { getT } from "@/i18n/server";

export default async function Loading() {
  const t = await getT();

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between">
          <div
            aria-label={t("reviewEditor.exit")}
            className="grid size-10 place-items-center rounded-full text-[#75777d]"
          >
            <LoadingCloseIcon />
          </div>
          <div className="min-w-0 flex-1" />
          <div className="rounded-full bg-[var(--theme-primary)] px-5 py-2 text-sm font-bold text-white shadow-sm">
            {t("noteEditor.publish")}
          </div>
        </div>
      </header>
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 pb-28 pt-20">
        <div className="text-[2rem] font-bold leading-tight text-[#c5c6cd] sm:text-[2.35rem]">
          {t("noteEditor.titlePlaceholder")}
        </div>
      </section>
    </main>
  );
}

function LoadingCloseIcon() {
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
