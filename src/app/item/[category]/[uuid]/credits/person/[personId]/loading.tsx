export default function Loading() {
  return (
    <>
      <PersonWorksLoadingTopBar />
      <div aria-hidden="true" className="h-16" />
      <main className="min-h-dvh bg-[var(--background)] px-5 pb-24 pt-5 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
          <section className="rounded-[2rem] border border-white/70 bg-white/60 p-5 shadow-lg shadow-slate-900/5">
            <div className="flex gap-4">
              <div className="size-20 shrink-0 animate-pulse rounded-full bg-[#dde3eb] shadow-inner" />
              <div className="min-w-0 flex-1 pt-1">
                <div className="h-7 w-44 max-w-full animate-pulse rounded-full bg-[#e2e2e5]" />
                <div className="mt-3 h-4 w-56 max-w-[80%] animate-pulse rounded-full bg-[#e2e2e5]" />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          </section>

          <div className="flex items-center justify-between gap-4 px-1">
            <div className="h-4 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-[#e2e2e5]" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 5 }, (_, index) => (
              <article
                className="relative rounded-2xl border border-white/70 bg-white/60 shadow-lg shadow-slate-900/5"
                key={index}
              >
                <div className="p-3 pr-12">
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <div className="aspect-[3/4] animate-pulse rounded-xl bg-[#e2e2e5]" />
                    <div className="min-w-0 space-y-3 py-1">
                      <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#e2e2e5]" />
                      <div className="h-5 w-1/2 animate-pulse rounded-full bg-[#e2e2e5]" />
                      <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
                      <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
                    </div>
                  </div>
                </div>
                <div className="absolute right-3 top-3 size-9 animate-pulse rounded-full bg-[#e2e2e5]" />
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function PersonWorksLoadingTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
        <div className="grid size-10 shrink-0 place-items-center rounded-full text-[#44474c]">
          <CloseIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-4 w-32 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
        <div aria-hidden="true" className="size-10 shrink-0" />
      </div>
    </header>
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
