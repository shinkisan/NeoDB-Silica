export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]">
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
          <div className="grid size-10 place-items-center rounded-full text-[#44474c]">
            <CloseIcon />
          </div>
          <div className="h-5 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
      </header>
      <section className="mx-auto grid max-w-2xl grid-cols-1 gap-3 lg:max-w-4xl lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <article
            className="surface-glow relative rounded-2xl border border-white/70 bg-white/55 px-5 pb-1.5 pt-5 shadow-lg shadow-slate-900/5"
            key={index}
          >
            <div className="surface-glow-floating absolute right-3 top-3 size-8 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-6 w-3/5 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
            <div className="mt-1.5 flex h-7 items-center justify-between gap-3 pt-1">
              <div className="h-3 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-3 w-20 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          </article>
        ))}
      </section>
    </main>
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
