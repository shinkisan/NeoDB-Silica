export function ProfileFollowsLoading({ title }: { title: string }) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full text-[#44474c]">
            <CloseIcon />
          </div>
          <p className="min-w-0 flex-1 truncate text-base font-bold text-[var(--foreground)]">
            {title}
          </p>
        </div>
      </header>
      <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]">
        <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              className="flex items-center gap-3 border-b-2 border-[#c5c6cd]/30 p-4 last:border-0"
              key={index}
            >
              <div className="size-12 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded-full bg-[#e2e2e5]" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
              </div>
              <div className="h-9 w-16 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          ))}
        </section>
      </main>
    </>
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
