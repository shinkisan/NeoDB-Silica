import { getT } from "@/i18n/server";
import { FloatingTopBar, TopBarIsland } from "@/components/floating-top-bar";

export default async function Loading() {
  const t = await getT();

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <FloatingTopBar className="fixed inset-x-0 top-0 z-40" rowClassName="max-w-4xl justify-between">
        <TopBarIsland>
          <div
            aria-label={t("reviewEditor.exit")}
            className="grid size-10 place-items-center rounded-full text-[#75777d]"
          >
            <LoadingCloseIcon />
          </div>
        </TopBarIsland>
        <div className="min-w-0 flex-1" />
        <div className="rounded-full bg-[var(--theme-primary)] px-5 py-2 text-sm font-bold text-white shadow-sm">
          {t("noteEditor.publish")}
        </div>
      </FloatingTopBar>
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 pb-28 pt-20">
        <div className="text-[2rem] font-bold leading-tight text-[#c5c6cd] sm:text-[2.35rem]">
          {t("noteEditor.titlePlaceholder")}
        </div>
      </section>
    </main>
  );
}

function LoadingCloseIcon() {
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
