export function NotificationsLoading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)] lg:pl-32 lg:pr-8">
      <section className="mx-auto w-full max-w-2xl">
        <div className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl lg:pl-32 lg:pr-8">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-3">
            <div className="size-10 rounded-full bg-white/50" />
            <div className="h-5 w-20 rounded-full bg-white/50" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-slate-900/5">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="flex gap-3 border-b-2 border-[#c5c6cd]/30 p-4 last:border-0 sm:p-5"
              key={index}
            >
              <div className="size-11 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-4 w-3/5 animate-pulse rounded-full bg-[#e2e2e5]" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
                <div className="h-14 animate-pulse rounded-xl bg-[#e2e2e5]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
