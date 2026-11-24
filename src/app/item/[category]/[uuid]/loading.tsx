import { PendingDetailCover } from "./pending-detail-cover";
import { LoadingTopBar } from "./loading-top-bar";

export default function Loading() {
  return (
    <>
      <LoadingTopBar />
      <div aria-hidden="true" className="h-16" />

      <main className="detail-page-enter min-h-dvh overflow-x-hidden bg-[var(--background)] px-5 pb-32 pt-5 text-[var(--foreground)]">
        <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
          <section className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-5 [@media(orientation:landscape)]:grid-cols-[minmax(0,46%)_minmax(0,1fr)] [@media(orientation:landscape)]:items-start">
            <div className="aspect-[4/5] w-full min-w-0 max-w-full transform-gpu rounded-2xl [backface-visibility:hidden] [@media(orientation:landscape)]:aspect-[3/4]">
              <PendingDetailCover />
            </div>
            <div className="min-w-0 max-w-full space-y-4">
              <div className="h-4 w-20 skeleton rounded-full" />
              <div className="h-9 w-3/4 skeleton rounded-full" />
              <div className="flex gap-2">
                <div className="h-8 w-24 skeleton rounded-full" />
                <div className="h-8 w-28 skeleton rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 skeleton rounded-full" />
                <div className="h-4 skeleton rounded-full" />
                <div className="h-4 w-2/3 skeleton rounded-full" />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
