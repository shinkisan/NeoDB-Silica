export function MarkedPageSkeleton() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-8 text-[var(--foreground)] lg:pl-32 lg:pr-8">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="mx-auto h-[46px] w-full max-w-lg rounded-full border border-white/50 bg-white/55 p-1 shadow-2xl shadow-slate-900/10">
          <div className="h-9 w-1/4 rounded-full bg-[var(--theme-primary)] shadow-md" />
        </div>
        <MarkedListSkeleton />
      </section>
    </main>
  );
}

function MarkedCategoryBarSkeleton() {
  return (
    <div className="flex justify-center gap-2 overflow-hidden">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton
          className="h-8 w-16 shrink-0 rounded-full"
          key={index}
        />
      ))}
    </div>
  );
}

export function MarkedListSkeleton() {
  return (
    <div className="space-y-4">
      <MarkedCategoryBarSkeleton />
      <MarkedCardsSkeleton />
    </div>
  );
}

export function MarkedCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 6 }, (_, index) => (
        <article
          className="rounded-xl border border-white/70 bg-white/55 p-3 shadow-lg shadow-slate-900/5"
          key={index}
        >
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            <Skeleton className="aspect-[3/4] rounded-xl" />
            <div className="flex h-[8.666rem] min-w-0 flex-col overflow-hidden py-0.5 sm:h-40">
              <Skeleton className="h-5 w-3/4 rounded-full" />
              <Skeleton className="mt-1 h-4 w-20 rounded-full" />
              <div className="mt-2 flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-11/12 rounded-full" />
                <Skeleton className="hidden h-4 w-2/3 rounded-full sm:block" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
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
