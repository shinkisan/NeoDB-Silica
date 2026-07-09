export default function Loading() {
  return (
    <>
      <CreditsLoadingTopBar />
      <div aria-hidden="true" className="h-16" />
      <main className="min-h-dvh bg-[var(--background)] px-5 pb-24 pt-5 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
          <div className="space-y-2 px-1">
            <div className="h-8 w-48 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-[#e2e2e5]" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 12 }, (_, index) => (
              <div
                className="rounded-2xl border border-white/70 bg-white/60 p-4 shadow-lg shadow-slate-900/5"
                key={index}
              >
                <div className="mx-auto size-20 animate-pulse rounded-full bg-[#e2e2e5]" />
                <div className="mx-auto mt-3 h-4 w-20 animate-pulse rounded-full bg-[#e2e2e5]" />
                <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded-full bg-[#e2e2e5]" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function CreditsLoadingTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
        <div className="grid size-10 shrink-0 place-items-center rounded-full text-[#44474c]">
          <CloseIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-4 w-28 animate-pulse rounded-full bg-[#e2e2e5]" />
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
