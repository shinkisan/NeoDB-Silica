import { getT } from "@/i18n/server";

export default async function Loading() {
  const t = await getT();

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3">
          <div className="size-10 shrink-0 rounded-full bg-[#e2e2e5]" />
          <div className="h-5 w-40 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
      </header>
      <div aria-hidden="true" className="h-16" />
      <main className="px-5 pb-32 pt-8">
        <section className="mx-auto max-w-2xl lg:max-w-4xl">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                aria-hidden="true"
                className="surface-glow rounded-2xl border border-white/70 bg-white/55 px-5 pb-1.5 pt-5 shadow-lg shadow-slate-900/5"
                key={index}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#dfe0e4]" />
                  <div className="size-7 animate-pulse rounded-full bg-[#dfe0e4]" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-4 animate-pulse rounded-full bg-[#dfe0e4]" />
                  <div className="h-4 animate-pulse rounded-full bg-[#dfe0e4]" />
                  <div className="h-4 w-4/5 animate-pulse rounded-full bg-[#dfe0e4]" />
                </div>
                <div className="mt-2 flex h-7 justify-start pt-1">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-[#dfe0e4]" />
                </div>
              </div>
            ))}
          </div>
          <span className="sr-only">{t("detail.notes.title")}</span>
        </section>
      </main>
    </div>
  );
}
