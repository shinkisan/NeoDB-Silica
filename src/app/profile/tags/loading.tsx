export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
          <div className="grid size-10 place-items-center rounded-full text-[#44474c]">
            <CloseIcon />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
          <div aria-hidden="true" className="ml-auto size-10 shrink-0" />
        </div>
      </header>
      <section className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between gap-4 px-1">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 10 }, (_, index) => (
            <article
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/55 px-5 py-4 shadow-lg shadow-slate-900/5 backdrop-blur-2xl"
              key={index}
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center text-[#75777d]/45">
                  <TagIcon />
                </span>
                <Skeleton className="h-6 w-28 rounded-full sm:w-40" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-3 w-16 rounded-full" />
                <ChevronRightIcon />
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

function TagIcon() {
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
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-[#75777d]/45"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
