import { FloatingTopBar, TopBarIsland } from "@/components/floating-top-bar";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]">
      <FloatingTopBar className="fixed inset-x-0 top-0 z-[60]" rowClassName="max-w-2xl lg:max-w-4xl">
        <TopBarIsland>
          <div className="grid size-10 place-items-center rounded-full text-[#44474c]">
            <CloseIcon />
          </div>
        </TopBarIsland>
        <div className="flex min-w-0 flex-1 justify-center">
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <div aria-hidden="true" className="size-10 shrink-0" />
      </FloatingTopBar>
      <section className="mx-auto max-w-2xl space-y-4 lg:max-w-4xl">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <article
              className="rounded-2xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5"
              key={index}
            >
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <Skeleton className="aspect-[3/4] rounded-xl" />
                <div className="min-w-0 py-1">
                  <Skeleton className="h-5 w-4/5 rounded-full" />
                  <Skeleton className="mt-2 h-5 w-2/5 rounded-full" />
                  <Skeleton className="mt-3 h-4 w-3/5 rounded-full" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Skeleton({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-[#e2e2e5]/80 ${className}`}
    />
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
