import { FloatingTopBar, TopBarIsland } from "@/components/floating-top-bar";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]">
      <FloatingTopBar className="fixed inset-x-0 top-0 z-[60]" rowClassName="max-w-2xl lg:max-w-4xl">
        <TopBarIsland>
          <div className="grid size-10 place-items-center rounded-full text-[#44474c]">
            <CloseIcon />
          </div>
        </TopBarIsland>
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="h-5 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
        <div aria-hidden="true" className="size-10 shrink-0" />
      </FloatingTopBar>
      <section className="mx-auto grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 9 }, (_, index) => (
          <div
            className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#e2e2e5]"
            key={index}
          >
            <div className="absolute inset-x-0 bottom-0 p-2">
              <div className="flex items-center gap-2 rounded-2xl bg-white/35 p-2.5">
                <div className="h-4 min-w-0 flex-1 animate-pulse rounded-full bg-white/55" />
                <div className="size-9 shrink-0 animate-pulse rounded-full bg-white/55" />
              </div>
            </div>
          </div>
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
