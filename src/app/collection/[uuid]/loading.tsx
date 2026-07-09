import {
  CollectionLoadingScrollTop,
  CollectionTopBar,
} from "./collection-chrome";
import { getT } from "@/i18n/server";

export default async function Loading() {
  const t = await getT();

  return (
    <>
      <CollectionTopBar title={t("collection.title")} />
      <CollectionLoadingScrollTop />
      <div aria-hidden="true" className="h-16" />
      <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-6 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-6 lg:max-w-4xl">
          <section className="min-w-0 space-y-3">
            <div className="h-10 w-4/5 max-w-full animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-5 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          </section>
          <div className="flex items-center justify-between gap-4 px-1">
            <div className="h-4 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-4 w-20 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
          </div>
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 5 }, (_, index) => (
              <article
                className="rounded-2xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5"
                key={index}
              >
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
                  <div className="aspect-[3/4] animate-pulse rounded-xl bg-[#e2e2e5]" />
                  <div className="space-y-3 py-1">
                    <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#e2e2e5]" />
                    <div className="h-6 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
                    <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
                    <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
