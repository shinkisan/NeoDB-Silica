export default function ProfileLoading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-8 text-[var(--foreground)]">
      <section className="mx-auto flex max-w-2xl flex-col gap-10">
        <header className="flex flex-col items-center pt-8 text-center">
          <div className="mb-6 grid size-32 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/55 shadow-[0_18px_48px_-18px_rgba(74,85,104,0.25)] backdrop-blur-2xl">
            <Skeleton className="size-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="mt-3 h-4 w-48 rounded-full" />
          <div className="mt-6 grid grid-cols-3 gap-8">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="flex min-w-14 flex-col items-center" key={index}>
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="mt-1 h-3 w-12 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Skeleton className="h-12 w-28 rounded-full" />
            <Skeleton className="h-12 w-24 rounded-full" />
          </div>
        </header>

        <div className="space-y-8">
          <SkeletonGroup titleWidth="w-20" rows={3} />
          <SkeletonGroup titleWidth="w-12" rows={7} />
          <SkeletonGroup titleWidth="w-12" rows={5} />
        </div>
      </section>
    </main>
  );
}

function SkeletonGroup({
  rows = 2,
  titleWidth,
}: {
  rows?: number;
  titleWidth: string;
}) {
  return (
    <section>
      <Skeleton className={`mb-4 ml-4 h-3 ${titleWidth} rounded-full`} />
      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/50 shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
        {Array.from({ length: rows }, (_, index) => (
          <div
            className="flex items-center justify-between gap-4 border-b-2 border-[#c5c6cd]/30 p-4 last:border-0"
            key={index}
          >
            <div className="flex min-w-0 items-center gap-4">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </section>
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
