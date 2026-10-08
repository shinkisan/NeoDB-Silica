import { cookies } from "next/headers";
import { getT } from "@/i18n/server";
import { isCoverImageProxyEnabled } from "@/lib/cover-image";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { ProfileDismissedTopBar } from "./profile-dismissed-chrome";
import { ProfileDismissedList } from "./profile-dismissed-list";
import { ScrollTopOnEntry } from "@/components/scroll-top-on-entry";

export const dynamic = "force-dynamic";

export default async function ProfileDismissedPage() {
  const t = await getT();
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  return (
    <>
      <ScrollTopOnEntry scope="dismissed" />
      <ProfileDismissedTopBar
        neodbUrl={
          session?.accessToken
            ? `${session.instance}/recommendations/hidden`
            : null
        }
        title={t("profile.dismissed.title")}
      />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-profile-dismissed-page
      >
        <section className="mx-auto max-w-2xl">
          {session?.accessToken ? (
            <ProfileDismissedList
              hiddenListHref={`${session.instance}/recommendations/hidden`}
              isCoverProxyEnabled={isCoverImageProxyEnabled()}
            />
          ) : (
            <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm font-semibold text-[#44474c]">
              {t("profile.dismissed.loginRequired")}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
