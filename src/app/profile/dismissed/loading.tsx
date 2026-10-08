import { FloatingTopBar, TopBarIsland } from "@/components/floating-top-bar";
import { ScrollTopOnEntry } from "@/components/scroll-top-on-entry";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]">
      <ScrollTopOnEntry scope="dismissed" />
      <FloatingTopBar
        className="fixed inset-x-0 top-0 z-[60]"
        rowClassName="max-w-2xl lg:max-w-4xl"
      >
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
      <section className="mx-auto max-w-2xl space-y-3 lg:max-w-4xl">
        <div className="h-16 animate-pulse rounded-2xl border border-[#e2e2e5] bg-white/70" />
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#e2e2e5] bg-white/70 p-3"
            key={index}
          >
            <div className="h-16 w-12 shrink-0 animate-pulse rounded-lg bg-[#e2e2e5]" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-3/5 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="mt-2 h-3 w-2/5 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
            <div className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
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
