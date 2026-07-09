import { VersionsTopBar } from "./versions-chrome";
import { VersionsLoadingScrollTop } from "./versions-scroll";

export default function Loading() {
  return (
    <>
      <VersionsTopBar title="" />
      <VersionsLoadingScrollTop />
      <div aria-hidden="true" className="h-16" />
      <main className="min-h-dvh bg-[var(--background)] px-5 pb-24 pt-5 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
          <div className="space-y-2 px-1">
            <div className="h-8 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-20 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5 sm:grid-cols-[104px_minmax(0,1fr)]"
                key={index}
              >
                <div className="aspect-[3/4] animate-pulse rounded-lg bg-[#e2e2e5]" />
                <div className="space-y-3 py-1">
                  <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#e2e2e5]" />
                  <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#e2e2e5]" />
                  <div className="flex gap-2">
                    <div className="h-7 w-20 animate-pulse rounded-full bg-[#e2e2e5]" />
                    <div className="h-7 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
                  </div>
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
