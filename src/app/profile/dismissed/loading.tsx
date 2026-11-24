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
          <div className="h-5 w-24 skeleton rounded-full" />
        </div>
        <div aria-hidden="true" className="size-10 shrink-0" />
      </FloatingTopBar>
      <section className="mx-auto max-w-2xl">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="aspect-[3/4] skeleton rounded-xl"
              key={index}
            />
          ))}
        </div>
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
