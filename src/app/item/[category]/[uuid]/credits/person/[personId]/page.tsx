import { notFound } from "next/navigation";
import {
  fetchTmdbJson,
  getTmdbCredentials,
  getTmdbLanguage,
  getTmdbPosterUrl,
  getTmdbProfileUrl,
  type TmdbMediaType,
} from "@/lib/tmdb";
import { getLocale, getT } from "@/i18n/server";
import { CreditsTopBar } from "../../credits-chrome";
import { PersonBiography } from "./person-biography";
import { PersonWorkActionCard } from "./person-work-action-card";
import { PersonWorksPagination } from "./person-works-pagination";
import { PersonWorksScrollManager } from "./person-works-scroll";

type PersonWorksPageProps = {
  params: Promise<{
    category: string;
    personId: string;
    uuid: string;
  }>;
  searchParams: Promise<{
    name?: string;
    page?: string;
  }>;
};

type TmdbPerson = {
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  known_for_department?: string;
  name?: string;
  place_of_birth?: string | null;
  profile_path?: string | null;
};

const PERSON_WORKS_PAGE_SIZE = 20;

type TmdbPersonCastCredit = {
  character?: string;
  episode_count?: number;
  id?: number;
  first_air_date?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  title?: string;
};

type TmdbPersonCrewCredit = {
  department?: string;
  episode_count?: number;
  id?: number;
  job?: string;
  first_air_date?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  title?: string;
};

type PersonWork = {
  id: number;
  posterUrl: string | null;
  role: string;
  searchHref: string;
  tmdbUrl: string;
  title: string;
  year: string | null;
};

export default async function PersonWorksPage({
  params,
  searchParams,
}: PersonWorksPageProps) {
  const { category, personId } = await params;
  const { name: nameParam, page: pageParam } = await searchParams;
  const t = await getT();
  const locale = await getLocale();
  const mediaType = getCreditsMediaType(category);

  if (!mediaType) {
    notFound();
  }

  const person = await fetchPersonWorks(
    personId,
    mediaType,
    nameParam,
    t,
    getTmdbLanguage(locale),
  );
  const pageTitle = t("credits.worksTitle").replace("{name}", person.name);
  const pages = Math.max(
    1,
    Math.ceil(person.works.length / PERSON_WORKS_PAGE_SIZE),
  );
  const parsedPage = Number(pageParam || 1);
  const page = Math.min(
    pages,
    Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1),
  );
  const pageWorks = person.works.slice(
    (page - 1) * PERSON_WORKS_PAGE_SIZE,
    page * PERSON_WORKS_PAGE_SIZE,
  );

  return (
    <>
      <CreditsTopBar title={pageTitle} />
      <PersonWorksScrollManager personId={personId} />
      <div aria-hidden="true" className="h-16" />
      <main className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-24 pt-5 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
          {page === 1 ? (
            <section className="rounded-[2rem] border border-white/70 bg-white/60 p-5 shadow-lg shadow-slate-900/5">
              <div className="flex gap-4">
                <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[#dde3eb] text-[#75777d] shadow-inner">
                  {person.profileUrl ? (
                    <img
                      alt={person.name}
                      className="h-full w-full object-cover"
                      src={person.profileUrl}
                    />
                  ) : (
                    <PersonIcon />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-2xl font-bold leading-tight text-[var(--foreground)]">
                    {person.name}
                  </h1>
                  {person.meta.length ? (
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#75777d]">
                      {person.meta.join(" / ")}
                    </p>
                  ) : null}
                </div>
              </div>
              {person.biography ? (
                <PersonBiography text={person.biography} />
              ) : (
                <p className="mt-4 text-sm leading-7 text-[#75777d]">
                  {t("credits.noBiography")}
                </p>
              )}
            </section>
          ) : null}

          {person.works.length ? (
            <div className="flex items-center justify-between gap-4 px-1 text-sm font-semibold text-[#75777d]">
              <span>
                {t("credits.worksCount").replace(
                  "{count}",
                  String(person.works.length),
                )}
              </span>
              <span>
                {t("credits.pageLabel")
                  .replace("{page}", String(page))
                  .replace("{pages}", String(pages))}
              </span>
            </div>
          ) : null}

          {pageWorks.length ? (
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {pageWorks.map((work, index) => (
                <PersonWorkActionCard
                  key={`${work.id}-${work.role}-${index}`}
                  personId={personId}
                  searchHref={work.searchHref}
                  tmdbUrl={work.tmdbUrl}
                >
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#e2e2e5]">
                      {work.posterUrl ? (
                        <img
                          alt={work.title}
                          className="h-full w-full object-cover"
                          loading={index < 8 ? "eager" : "lazy"}
                          src={work.posterUrl}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-[#75777d]">
                          {work.title}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 py-1">
                      <h2 className="line-clamp-2 min-w-0 text-lg font-bold leading-snug text-[var(--foreground)]">
                        {work.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {work.year ? (
                          <span className="rounded-full border border-white/70 bg-white/65 px-2.5 py-1 text-xs font-bold text-[#44474c]">
                            {work.year}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#44474c]">
                        {work.role}
                      </p>
                    </div>
                  </div>
                </PersonWorkActionCard>
              ))}
            </section>
          ) : (
            <div className="rounded-2xl border border-white/70 bg-white/60 p-6 text-sm leading-6 text-[#44474c] shadow-lg shadow-slate-900/5">
              {t("credits.noWorks")}
            </div>
          )}
          <PersonWorksPagination currentPage={page} pages={pages} />
        </div>
      </main>
    </>
  );
}

async function fetchPersonWorks(
  personId: string,
  mediaType: TmdbMediaType,
  fallbackName: string | undefined,
  t: Awaited<ReturnType<typeof getT>>,
  language: string,
) {
  const credentials = getTmdbCredentials();
  const fallback = (fallbackName || "").trim() || t("credits.person");

  if (!credentials || !/^\d+$/.test(personId)) {
    return {
      biography: "",
      meta: [] as string[],
      name: fallback,
      profileUrl: null,
      works: [] as PersonWork[],
    };
  }

  try {
    const [person, credits] = await Promise.all([
      fetchTmdbJson<TmdbPerson>(
        `https://api.themoviedb.org/3/person/${personId}`,
        credentials,
        language,
      ),
      fetchTmdbJson<{
        cast?: TmdbPersonCastCredit[];
        crew?: TmdbPersonCrewCredit[];
      }>(
        `https://api.themoviedb.org/3/person/${personId}/${mediaType}_credits`,
        credentials,
        language,
      ),
    ]);

    return {
      biography: person.biography || "",
      meta: getPersonMeta(person),
      name: person.name || fallback,
      profileUrl: getTmdbProfileUrl(person.profile_path),
      works: normalizeWorks(
        credits.cast || [],
        credits.crew || [],
        mediaType,
        t,
      ),
    };
  } catch {
    return {
      biography: "",
      meta: [] as string[],
      name: fallback,
      profileUrl: null,
      works: [] as PersonWork[],
    };
  }
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

function getPersonMeta(person: TmdbPerson) {
  return [
    person.known_for_department,
    getLifeSpan(person.birthday, person.deathday),
    person.place_of_birth,
  ].filter(Boolean) as string[];
}

function getLifeSpan(birthday?: string | null, deathday?: string | null) {
  if (!birthday && !deathday) {
    return "";
  }

  return `${birthday || "?"}${deathday ? ` - ${deathday}` : ""}`;
}

function normalizeWorks(
  cast: TmdbPersonCastCredit[],
  crew: TmdbPersonCrewCredit[],
  mediaType: TmdbMediaType,
  t: Awaited<ReturnType<typeof getT>>,
) {
  const works = new Map<number, PersonWork>();

  for (const credit of crew) {
    const title = getCreditTitle(credit);

    if (!credit.id || !title) {
      continue;
    }

    const existing = works.get(credit.id);
    const role = translateJob(credit.job, t);
    const year = getYear(getCreditDate(credit));

    works.set(credit.id, {
      id: credit.id,
      posterUrl: getTmdbPosterUrl(credit.poster_path),
      role: mergeRole(existing?.role, role),
      searchHref: getSearchHref(title, year, mediaType),
      tmdbUrl: getTmdbMediaUrl(credit.id, mediaType),
      title,
      year,
    });
  }

  for (const credit of cast) {
    const title = getCreditTitle(credit);

    if (!credit.id || !title) {
      continue;
    }

    const existing = works.get(credit.id);
    const role = credit.character
      ? t("credits.role.actorWithCharacter").replace(
          "{character}",
          credit.character,
        )
      : t("credits.role.actor");
    const year = getYear(getCreditDate(credit));

    works.set(credit.id, {
      id: credit.id,
      posterUrl: existing?.posterUrl || getTmdbPosterUrl(credit.poster_path),
      role: mergeRole(existing?.role, role),
      searchHref:
        existing?.searchHref || getSearchHref(title, year, mediaType),
      tmdbUrl: existing?.tmdbUrl || getTmdbMediaUrl(credit.id, mediaType),
      title: existing?.title || title,
      year: existing?.year || year,
    });
  }

  return [...works.values()].sort((a, b) => {
    const yearDiff = Number(b.year || 0) - Number(a.year || 0);

    if (yearDiff !== 0) {
      return yearDiff;
    }

    return a.title.localeCompare(b.title);
  });
}

function translateJob(
  job: string | undefined,
  t: Awaited<ReturnType<typeof getT>>,
) {
  const jobs: Record<string, string> = {
    Director: t("credits.role.director"),
    Producer: t("credits.role.producer"),
    Screenplay: t("credits.role.writer"),
    Story: t("credits.role.writer"),
    Writer: t("credits.role.writer"),
  };

  return jobs[job || ""] || job || t("credits.role.crew");
}

function mergeRole(current: string | undefined, next: string) {
  if (!current) {
    return next;
  }

  return current.split(" / ").includes(next) ? current : `${current} / ${next}`;
}

function getYear(date: string | undefined) {
  return date?.match(/^\d{4}/)?.[0] || null;
}

function getCreditTitle(credit: TmdbPersonCastCredit | TmdbPersonCrewCredit) {
  return credit.title || credit.name || "";
}

function getCreditDate(credit: TmdbPersonCastCredit | TmdbPersonCrewCredit) {
  return credit.release_date || credit.first_air_date;
}

function getSearchHref(
  title: string,
  year: string | null,
  mediaType: TmdbMediaType,
) {
  const params = new URLSearchParams({
    category: mediaType === "tv" ? "tv" : "movie",
    q: [title, year].filter(Boolean).join(" "),
  });

  return `/search?${params.toString()}`;
}

function getTmdbMediaUrl(id: number, mediaType: TmdbMediaType) {
  return `https://www.themoviedb.org/${mediaType}/${id}`;
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
