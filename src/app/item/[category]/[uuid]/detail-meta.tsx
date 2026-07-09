import { SearchMetaLink } from "./search-meta-link";

export type DetailMeta = {
  query?: string;
  text: string;
};

type Translate = (key: string) => string;

type Credit = {
  name?: string | null;
  role?: string | null;
};

type DetailMetaItem = {
  artist?: string[];
  author?: string[];
  category: string;
  company?: string[];
  creator?: string[];
  credits?: Credit[];
  developer?: string[] | string | null;
  director?: string[];
  duration?: number | string | null;
  genre?: string[] | string | null;
  genres?: string[] | string | null;
  opening_date?: string | null;
  pub_house?: string[];
  pub_month?: string | null;
  pub_year?: string | null;
  publisher?: string[] | string | null;
  release_date?: string | null;
  runtime?: number | string | null;
  tags?: string[] | null;
  track_list?: string | null;
  translator?: string[] | string | null;
  year?: number | string | null;
};

export function getDetailMeta(item: DetailMetaItem, t: Translate): DetailMeta[] {
  if (item.category === "book") {
    return getBookMeta(item, t);
  }

  if (isVideoMetaCategory(item.category)) {
    return getVideoMeta(item, t);
  }

  if (item.category === "music") {
    return getMusicMeta(item, t);
  }

  if (item.category === "game") {
    return getGameMeta(item, t);
  }

  const credits = item.credits || [];
  const searchableRoles = new Set([
    "author",
    "director",
    "artist",
    "publisher",
    "imprint",
    "studio",
    "developer",
  ]);
  const people = credits
    .filter((credit) => credit.name && searchableRoles.has(credit.role || ""))
    .map((credit) => ({
      query: credit.name as string,
      text: `${translateRole(credit.role || undefined, t)}：${credit.name}`,
    }));

  const fallbackPeople = people.length
    ? people
    : credits
        .filter((credit) => credit.name)
        .slice(0, 2)
        .map((credit) => ({
          query: credit.name as string,
          text: `${translateRole(credit.role || undefined, t)}：${credit.name}`,
        }));

  return [
    ...fallbackPeople.slice(0, 3),
    ...(item.tags || []).slice(0, 4).map((tag) => ({ text: translateTag(tag, t) })),
  ];
}

export function getDetailHashtags(tags: string[], t: Translate) {
  return uniqueTextValues(tags)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => ({
      label: translateTag(tag, t),
      tag,
    }));
}

export function getCategoryLabel(category: string, t: Translate) {
  const keys: Record<string, string> = {
    book: "book",
    movie: "movie",
    tv: "tv",
    "tv-season": "tv",
    "tv-episode": "tv",
    music: "music",
    game: "game",
    podcast: "podcast",
    "podcast-episode": "podcast",
    performance: "performance",
    "performance-production": "performance",
  };
  const key = keys[category];

  if (!key) {
    return category;
  }

  const translated = t(`category.${key}`);

  return translated === `category.${key}` ? category : translated;
}

export function MetaBadge({ entry }: { entry: DetailMeta }) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-[#b2ccc1]/60 bg-[#cee8dd]/35 px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[#cee8dd]/60";

  if (!entry.query) {
    return <span className={className}>{entry.text}</span>;
  }

  const params = new URLSearchParams({
    category: "all",
    q: entry.query,
  });

  const href = `/search?${params.toString()}`;

  return (
    <SearchMetaLink className={className} href={href}>
      {entry.text}
      <SearchIcon />
    </SearchMetaLink>
  );
}

function getBookMeta(item: DetailMetaItem, t: Translate): DetailMeta[] {
  const authors = uniqueTextValues([
    ...toTextArray(item.author),
    ...getCreditNames(item, "author"),
  ]).slice(0, 2);
  const publishers = uniqueTextValues([
    ...toTextArray(item.publisher),
    ...toTextArray(item.pub_house),
    ...getCreditNames(item, "publisher"),
  ]).slice(0, 2);
  const translators = uniqueTextValues([
    ...toTextArray(item.translator),
    ...getCreditNames(item, "translator"),
  ]).slice(0, 2);
  const publishedAt = formatPublishedAt(item.pub_year, item.pub_month);

  return [
    ...authors.map((name) => ({
      query: name,
      text: `${translateRole("author", t)}：${name}`,
    })),
    ...publishers.map((name) => ({
      query: name,
      text: `${translateRole("publisher", t)}：${name}`,
    })),
    ...translators.map((name) => ({
      query: name,
      text: `${translateRole("translator", t)}：${name}`,
    })),
    publishedAt ? { text: `${t("detail.meta.publishDate")}：${publishedAt}` } : null,
  ].filter((entry): entry is DetailMeta => Boolean(entry));
}

function getMusicMeta(item: DetailMetaItem, t: Translate): DetailMeta[] {
  const artists = uniqueTextValues([
    ...toTextArray(item.artist),
    ...getCreditNames(item, "artist"),
  ]).slice(0, 2);
  const labels = uniqueTextValues([
    ...toTextArray(item.company),
    ...getCreditNames(item, "record_label"),
  ]).slice(0, 2);
  const genres = toTextArray(item.genre || item.genres)
    .map((genre) => translateGenre(genre, t))
    .slice(0, 3);
  const trackCount = getTrackCount(item.track_list);

  return [
    ...artists.map((name) => ({
      query: name,
      text: `${translateRole("artist", t)}：${name}`,
    })),
    ...labels.map((name) => ({
      query: name,
      text: `${translateRole("record_label", t)}：${name}`,
    })),
    item.release_date
      ? { text: `${t("detail.meta.releaseDate")}：${item.release_date}` }
      : null,
    trackCount
      ? { text: t("detail.meta.tracks").replace("{count}", String(trackCount)) }
      : null,
    ...genres.map((genre) => ({ text: genre })),
  ].filter((entry): entry is DetailMeta => Boolean(entry));
}

function getGameMeta(item: DetailMetaItem, t: Translate): DetailMeta[] {
  const developers = uniqueTextValues([
    ...toTextArray(item.developer),
    ...getCreditNames(item, "developer"),
  ]).slice(0, 2);
  const publishers = uniqueTextValues([
    ...toTextArray(item.publisher),
    ...getCreditNames(item, "publisher"),
    ...getCreditNames(item, "studio"),
  ]).slice(0, 2);
  const releaseDate = item.release_date || item.opening_date || "";
  const releaseYear = item.year ? String(item.year) : "";
  const genres = toTextArray(item.genre || item.genres)
    .map((genre) => translateGenre(genre, t))
    .slice(0, 4);

  return [
    ...developers.map((name) => ({
      query: name,
      text: `${translateRole("developer", t)}：${name}`,
    })),
    ...publishers.map((name) => ({
      query: name,
      text: `${translateRole("publisher", t)}：${name}`,
    })),
    releaseDate
      ? { text: `${t("detail.meta.releaseDate")}：${releaseDate}` }
      : releaseYear
        ? { text: `${t("detail.meta.year")}：${releaseYear}` }
        : null,
    ...genres.map((genre) => ({ text: genre })),
  ].filter((entry): entry is DetailMeta => Boolean(entry));
}

function getVideoMeta(item: DetailMetaItem, t: Translate): DetailMeta[] {
  const people = getVideoPeople(item).slice(0, 2);
  const releaseDate = item.release_date || item.opening_date || "";
  const releaseYear = item.year ? String(item.year) : "";
  const duration = formatDuration(item.duration ?? item.runtime, t);
  const genres = toTextArray(item.genre || item.genres)
    .map((genre) => translateGenre(genre, t))
    .slice(0, 3);

  return [
    ...people.map(({ name, role }) => ({
      query: name,
      text: `${translateRole(role, t)}：${name}`,
    })),
    releaseDate
      ? { text: `${t("detail.meta.releaseDate")}：${releaseDate}` }
      : releaseYear
        ? { text: `${t("detail.meta.year")}：${releaseYear}` }
        : null,
    duration ? { text: `${t("detail.meta.duration")}：${duration}` } : null,
    ...genres.map((genre) => ({ text: genre })),
  ].filter((entry): entry is DetailMeta => Boolean(entry));
}

function getVideoPeople(item: DetailMetaItem) {
  const creditDirectors = (item.credits || [])
    .filter((credit) => credit.role === "director" && credit.name)
    .map((credit) => credit.name as string);
  const directors = uniqueTextValues([
    ...toTextArray(item.director),
    ...creditDirectors,
  ]).map((name) => ({ name, role: "director" }));

  if (directors.length) {
    return directors;
  }

  const creditCreators = (item.credits || [])
    .filter((credit) => credit.role === "creator" && credit.name)
    .map((credit) => credit.name as string);

  return uniqueTextValues([...toTextArray(item.creator), ...creditCreators]).map(
    (name) => ({ name, role: "creator" }),
  );
}

function isVideoMetaCategory(category: string) {
  return (
    category === "movie" ||
    category === "tv" ||
    category === "tv-season" ||
    category === "tv-episode"
  );
}

function getCreditNames(item: DetailMetaItem, role: string) {
  return (item.credits || [])
    .filter((credit) => credit.role === role && credit.name)
    .map((credit) => credit.name as string);
}

function getTrackCount(trackList: string | null | undefined) {
  if (!trackList) {
    return 0;
  }

  return trackList
    .split(/\r?\n/)
    .map((track) => track.trim())
    .filter(Boolean).length;
}

function formatPublishedAt(
  year: number | string | null | undefined,
  month: number | string | null | undefined,
) {
  if (!year) {
    return "";
  }

  const yearText = String(year).trim();
  const monthText = month ? String(month).trim() : "";

  return monthText ? `${yearText}-${monthText.padStart(2, "0")}` : yearText;
}

function formatDuration(
  value: number | string | null | undefined,
  t: Translate,
) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return t("detail.meta.minutes").replace("{count}", String(value));
  }

  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^\d+$/.test(trimmed)
    ? t("detail.meta.minutes").replace("{count}", trimmed)
    : trimmed;
}

function toTextArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return uniqueTextValues(value);
  }

  if (typeof value === "string") {
    return uniqueTextValues(
      value
        .split(/[、,，/]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }

  return [];
}

function uniqueTextValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function translateGenre(value: string, t: Translate) {
  const key = value.trim().toLowerCase();
  const genreLabels: Record<string, string> = {
    action: "action",
    adventure: "adventure",
    animation: "animation",
    biography: "biography",
    comedy: "comedy",
    crime: "crime",
    documentary: "documentary",
    drama: "drama",
    family: "family",
    fantasy: "fantasy",
    history: "history",
    horror: "horror",
    indie: "indie",
    independent: "indie",
    fighting: "fighting",
    fighter: "fighting",
    "visual novel": "visualNovel",
    "visual-novel": "visualNovel",
    vn: "visualNovel",
    "point-and-click": "pointAndClick",
    "point and click": "pointAndClick",
    card: "card",
    cards: "card",
    deckbuilder: "deckbuilder",
    "deck builder": "deckbuilder",
    "deck-building": "deckbuilder",
    "deck building": "deckbuilder",
    board: "board",
    "board game": "board",
    "board-game": "board",
    "card & board game": "cardBoard",
    "card and board game": "cardBoard",
    "card/board game": "cardBoard",
    casual: "casual",
    educational: "educational",
    education: "educational",
    mmo: "mmo",
    mmorpg: "mmo",
    roguelike: "roguelike",
    "rogue-like": "roguelike",
    "roguelike deckbuilder": "roguelikeDeckbuilder",
    "roguelike deck builder": "roguelikeDeckbuilder",
    "roguelike deck-building": "roguelikeDeckbuilder",
    "roguelike deck building": "roguelikeDeckbuilder",
    roguelite: "roguelite",
    "rogue-lite": "roguelite",
    survival: "survival",
    sandbox: "sandbox",
    "open world": "openWorld",
    "open-world": "openWorld",
    rhythm: "rhythm",
    tactical: "tactical",
    tactic: "tactical",
    "turn-based": "turnBased",
    "turn based": "turnBased",
    party: "party",
    stealth: "stealth",
    rock: "rock",
    shooter: "shooter",
    rpg: "rpg",
    "role-playing": "rpg",
    "role playing": "rpg",
    platformer: "platformer",
    puzzle: "puzzle",
    racing: "racing",
    strategy: "strategy",
    simulation: "simulation",
    sports: "sports",
    arcade: "arcade",
    aavg: "AAVG",
    "action-adventure": "AAVG",
    "action adventure": "AAVG",
    adv: "ADV",
    crpg: "CRPG",
    sim: "simulation",
    music: "music",
    musical: "musical",
    mystery: "mystery",
    romance: "romance",
    "sci-fi": "sciFi",
    "science fiction": "sciFi",
    short: "short",
    sport: "sport",
    thriller: "thriller",
    war: "war",
    western: "western",
  };
  const messageKey = genreLabels[key];

  if (!messageKey) {
    return value;
  }

  const translated = t(`detail.genre.${messageKey}`);

  return translated === `detail.genre.${messageKey}` ? value : translated;
}

function translateTag(value: string, t: Translate) {
  const key = value.trim().toLowerCase();
  const tagLabels: Record<string, string> = {
    racing: "racing",
    sports: "sports",
    action: "action",
    adventure: "adventure",
    rpg: "rpg",
    strategy: "strategy",
    simulation: "simulation",
    puzzle: "puzzle",
    platformer: "platformer",
    shooter: "shooter",
    indie: "indie",
    multiplayer: "multiplayer",
    singleplayer: "singleplayer",
    openworld: "openworld",
    "open-world": "open-world",
    sandbox: "sandbox",
    survival: "survival",
    horror: "horror",
    stealth: "stealth",
    fighting: "fighting",
    card: "card",
    "turn-based": "turn-based",
    "real-time": "real-time",
    "co-op": "co-op",
    coop: "coop",
    pvp: "pvp",
    anime: "anime",
    retro: "retro",
    pixel: "pixel",
    "story-rich": "story-rich",
    storyrich: "storyRich",
    exploration: "exploration",
    building: "building",
    crafting: "crafting",
    management: "management",
    driving: "driving",
    football: "football",
    basketball: "basketball",
    baseball: "baseball",
    tennis: "tennis",
    golf: "golf",
    boxing: "boxing",
    wrestling: "wrestling",
    skateboarding: "skateboarding",
    cycling: "cycling",
    swimming: "swimming",
    athletics: "athletics",
    "martial-arts": "martial-arts",
    martialarts: "martialArts",
  };
  const messageKey = tagLabels[key];

  if (!messageKey) {
    return value;
  }

  const translated = t(`detail.genre.${messageKey}`);

  return translated === `detail.genre.${messageKey}` ? value : translated;
}

function translateRole(role: string | undefined, t: Translate) {
  const key = role || "creator";
  const translated = t(`detail.role.${key}`);

  return translated === `detail.role.${key}` ? t("detail.role.creator") : translated;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
