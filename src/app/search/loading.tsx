export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 pb-28 pt-8 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-14 flex-1 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="size-14 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              className="aspect-[3/4] animate-pulse rounded-xl bg-[#e2e2e5]"
              key={index}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
