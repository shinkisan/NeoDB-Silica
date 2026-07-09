export function TimelinePageSkeleton() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-8 text-[var(--foreground)] lg:pl-32 lg:pr-8">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="mx-auto h-[46px] w-full max-w-lg rounded-full border border-white/50 bg-white/55 p-1 shadow-2xl shadow-slate-900/10 backdrop-blur-3xl">
          <div className="relative grid h-9 grid-cols-3">
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--theme-primary)] shadow-md" />
            {[0, 1, 2].map((i) => (
              <div className="relative z-10 grid h-9 place-items-center" key={i}>
                <Skeleton className={`h-3 w-10 rounded-full ${i === 0 ? "bg-white/50" : ""}`} />
              </div>
            ))}
          </div>
        </div>
        <TimelineListSkeleton />
      </section>
    </main>
  );
}

export function TimelineListSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/55 shadow-lg shadow-slate-900/5 backdrop-blur-2xl">
      {Array.from({ length: 5 }, (_, index) => (
        <article
          className="flex gap-3 border-b border-[#c5c6cd]/30 p-4 last:border-0 sm:gap-4 sm:p-5"
          key={index}
        >
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-full rounded-full" />
            <Skeleton className="mt-2 h-4 w-4/5 rounded-full" />
            {index % 2 === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/45 p-2.5">
                <Skeleton className="h-16 w-12 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-20 rounded-full" />
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex gap-8">
              <Skeleton className="h-4 w-10 rounded-full" />
              <Skeleton className="h-4 w-10 rounded-full" />
              <Skeleton className="h-4 w-10 rounded-full" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block animate-pulse bg-[#e2e2e5]/80 ${className}`} />;
}
