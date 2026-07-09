import { notFound } from "next/navigation";
import {
  getItemApiPath,
  getNeodbBaseUrl,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import {
  fetchTmdbJson,
  getTmdbCredentials,
  getTmdbLanguage,
  getTmdbMediaIdForItem,
  getTmdbProfileUrl,
  type TmdbMediaType,
  type TmdbCastMember,
  type TmdbCrewMember,
} from "@/lib/tmdb";
import { getLocale, getT } from "@/i18n/server";
import { CreditsTopBar } from "./credits-chrome";
import { CreditsPersonLink } from "./credits-person-link";
import { CreditsScrollManager } from "./credits-scroll";

type CreditsPageProps = {
  params: Promise<{
    category: string;
    uuid: string;
  }>;
};

type MediaItem = NeodbItem & {
  actor?: string[];
  director?: string[];
  producer?: string[];
  title?: string;
};

type CreditPerson = {
  avatarUrl: string | null;
  name: string;
  personId: number | null;
  role: string;
  source: "neodb" | "tmdb";
};

export default async function CreditsPage({ params }: CreditsPageProps) {
  const { category, uuid } = await params;
  const t = await getT();
  const locale = await getLocale();
  const mediaType = getCreditsMediaType(category);

  if (!mediaType) {
    notFound();
  }

  const item = await fetchMediaItem(category, uuid);
  const fallbackTitle = t("detail.fallbackTitle");
  const itemTitle = item?.display_title || item?.title || fallbackTitle;
  const pageTitle = t("credits.title").replace("{title}", itemTitle);
  const credits = item
    ? await fetchCredits(item, mediaType, t, getTmdbLanguage(locale))
    : [];

  return (
    <>
      <CreditsTopBar title={pageTitle} />
      <CreditsScrollManager category={category} itemUuid={uuid} />
      <div aria-hidden="true" className="h-16" />
      <main className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-24 pt-5 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
          <div className="px-1">
            <h1 className="text-2xl font-bold leading-tight text-[var(--foreground)]">
              {pageTitle}
            </h1>
            {credits.some((person) => person.source === "tmdb" && person.personId) ? (
              <p className="mt-1 text-sm leading-6 text-[#75777d]">
                {t("credits.clickHint")}
              </p>
            ) : null}
          </div>

          {credits.length ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {credits.map((person) => (
                <CreditCard
                  category={category}
                  key={`${person.role}-${person.name}`}
                  itemUuid={uuid}
                  person={person}
                />
              ))}
            </section>
          ) : (
            <div className="rounded-2xl border border-white/70 bg-white/60 p-6 text-sm leading-6 text-[#44474c] shadow-lg shadow-slate-900/5">
              {t("credits.empty")}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function getCreditsMediaType(category: string): TmdbMediaType | null {
  if (category === "movie") {
    return "movie";
  }

  if (
    category === "tv" ||
    category === "tv-season" ||
    category === "tv-episode"
  ) {
    return "tv";
  }

  return null;
}

async function fetchMediaItem(category: string, uuid: string) {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}${getItemApiPath(category, uuid)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 30 },
      },
      8_000,
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as MediaItem;
  } catch {
    return null;
  }
}

async function fetchCredits(
  item: MediaItem,
  mediaType: TmdbMediaType,
  t: Awaited<ReturnType<typeof getT>>,
  language: string,
) {
  const tmdbCredits = await fetchTmdbCredits(item, mediaType, t, language);

  if (tmdbCredits.length) {
    return tmdbCredits;
  }

  return getNeodbCredits(item, t);
}

async function fetchTmdbCredits(
  item: MediaItem,
  mediaType: TmdbMediaType,
  t: Awaited<ReturnType<typeof getT>>,
  language: string,
): Promise<CreditPerson[]> {
  const credentials = getTmdbCredentials();

  if (!credentials) {
    return [];
  }

  const tmdbId = await getTmdbMediaIdForItem(item, mediaType);

  if (!tmdbId) {
    return [];
  }

  try {
    const payload = await fetchTmdbJson<{
      cast?: TmdbCastMember[];
      crew?: TmdbCrewMember[];
    }>(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits`,
      credentials,
      language,
    );

    const directors = (payload.crew || [])
      .filter((member) => member.job === "Director")
      .map((member) => toCreditPerson(member, t("credits.role.director")));
    const writers = (payload.crew || [])
      .filter((member) =>
        ["Writer", "Screenplay", "Story"].includes(member.job || ""),
      )
      .slice(0, 6)
      .map((member) => toCreditPerson(member, t("credits.role.writer")));
    const cast = (payload.cast || [])
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .slice(0, 24)
      .map((member) =>
        toCreditPerson(
          member,
          member.character
            ? t("credits.role.actorWithCharacter").replace(
                "{character}",
                member.character,
              )
            : t("credits.role.actor"),
        ),
      );

    return dedupeCredits([...directors, ...writers, ...cast]);
  } catch {
    return [];
  }
}

function getNeodbCredits(
  item: MediaItem,
  t: Awaited<ReturnType<typeof getT>>,
) {
  const credits: CreditPerson[] = [
    ...toNamedCredits(item.director, t("credits.role.director")),
    ...toNamedCredits(item.actor, t("credits.role.actor")),
    ...toNamedCredits(item.producer, t("credits.role.producer")),
    ...(item.credits || []).map((credit) => ({
      avatarUrl: null,
      name: credit.name || "",
      personId: null,
      role: translateCreditRole(credit.role, t),
      source: "neodb" as const,
    })),
  ];

  return dedupeCredits(credits.filter((credit) => credit.name));
}

function toNamedCredits(names: string[] | undefined, role: string) {
  return (names || []).map((name) => ({
    avatarUrl: null,
    name,
    personId: null,
    role,
    source: "neodb" as const,
  }));
}

function toCreditPerson(
  member: TmdbCastMember | TmdbCrewMember,
  role: string,
): CreditPerson {
  return {
    avatarUrl: getTmdbProfileUrl(member.profile_path),
    name: member.name || "",
    personId: member.id || null,
    role,
    source: "tmdb",
  };
}

function dedupeCredits(credits: CreditPerson[]) {
  const seen = new Set<string>();
  const result: CreditPerson[] = [];

  for (const credit of credits) {
    const key = `${credit.name}-${credit.role}`;

    if (!credit.name || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(credit);
  }

  return result;
}

function translateCreditRole(
  role: string | undefined,
  t: Awaited<ReturnType<typeof getT>>,
) {
  const roles: Record<string, string> = {
    actor: t("credits.role.actor"),
    director: t("credits.role.director"),
    producer: t("credits.role.producer"),
    writer: t("credits.role.writer"),
  };

  return roles[role || ""] || t("credits.role.crew");
}

function CreditCard({
  category,
  itemUuid,
  person,
}: {
  category: string;
  itemUuid: string;
  person: CreditPerson;
}) {
  const content = (
    <>
      <div className="mx-auto grid size-20 place-items-center overflow-hidden rounded-full bg-[#dde3eb] text-[#75777d] shadow-inner">
        {person.avatarUrl ? (
          <img
            alt={person.name}
            className="h-full w-full object-cover"
            loading="lazy"
            src={person.avatarUrl}
          />
        ) : (
          <PersonIcon />
        )}
      </div>
      <h2 className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-[var(--foreground)]">
        {person.name}
      </h2>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#75777d]">
        {person.role}
      </p>
    </>
  );

  if (person.source === "tmdb" && person.personId) {
    const href = `/item/${encodeURIComponent(category)}/${encodeURIComponent(itemUuid)}/credits/person/${person.personId}?name=${encodeURIComponent(person.name)}`;

    return (
      <CreditsPersonLink
        category={category}
        className="relative block cursor-pointer rounded-2xl border border-white/70 bg-white/60 p-4 text-center shadow-lg shadow-slate-900/5 transition hover:bg-white/75 active:scale-[0.99]"
        href={href}
        itemUuid={itemUuid}
      >
        {content}
      </CreditsPersonLink>
    );
  }

  return (
    <article className="relative rounded-2xl border border-white/35 bg-white/25 p-4 text-center">
      {content}
    </article>
  );
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-9"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}
