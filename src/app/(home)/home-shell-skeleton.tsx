export function HomeShellSkeleton() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 pb-32 pt-7 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl">
        <div className="mb-4 h-14 rounded-full border border-white/70 bg-white/60 shadow-lg shadow-slate-900/5" />
        <HomeTagRailSkeleton />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              className="animate-pulse rounded-[2rem] border border-white/80 bg-white shadow-xl shadow-slate-900/5"
              key={index}
            >
              <div className="aspect-[3/4] rounded-[2rem] bg-[#e2e2e5]" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export function HomeTagRailSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mb-4 flex h-11 animate-pulse items-center gap-2 overflow-hidden px-10 py-1"
    >
      <div className="size-9 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="size-9 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="h-9 w-16 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="h-9 w-20 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="h-9 w-16 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="h-9 w-20 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="h-9 w-16 shrink-0 rounded-full bg-[#dde3eb]" />
    </div>
  );
}
