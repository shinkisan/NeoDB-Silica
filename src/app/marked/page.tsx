import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { getT } from "@/i18n/server";
import { MarkedContent } from "./marked-content";

export const dynamic = "force-dynamic";

export default async function MarkedPage() {
  const t = await getT();
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const categories = [
    { id: "all", label: t("category.all") },
    { id: "book", label: t("category.book") },
    { id: "movie", label: t("category.movie") },
    { id: "tv", label: t("category.tv") },
    { id: "music", label: t("category.music") },
    { id: "game", label: t("category.game") },
    { id: "podcast", label: t("category.podcast") },
    { id: "performance", label: t("category.performance") },
  ];

  return (
    <MarkedContent
      cacheScope={session ? getCacheScope(session) : null}
      categories={categories}
    />
  );
}

function getCacheScope(session: NeodbSessionCookie) {
  return crypto
    .createHash("sha256")
    .update(`${session.instance}:${session.createdAt}`)
    .digest("base64url")
    .slice(0, 20);
}
