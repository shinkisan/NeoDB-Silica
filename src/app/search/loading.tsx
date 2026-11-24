export default function Loading() {
  return (
    <main className="detail-page-enter min-h-dvh bg-[var(--background)] px-4 pb-28 pt-8 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-14 flex-1 skeleton rounded-full" />
          <div className="size-14 skeleton rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
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
