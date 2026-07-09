import { NextResponse } from "next/server";
import { locales, type Locale } from "@/i18n/config";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fetchTmdbJson,
  getTmdbCredentials,
  getTmdbLanguage,
  getTmdbPosterUrl,
} from "@/lib/tmdb";
import { isTmdbRegion } from "@/lib/tmdb-regions";

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=21600, stale-while-revalidate=43200";
const MAX_PAGE = 10;

type TmdbMovieListResult = {
  id?: number;
  original_title?: string;
  poster_path?: string | null;
  release_date?: string;
  title?: string;
};

type TmdbMovieListResponse = {
  results?: TmdbMovieListResult[];
  total_pages?: number;
};

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "tmdb:now-playing",
    limit: 60,
    request,
    windowMs: 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试。" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfter) },
        status: 429,
      },
    );
  }

  const credentials = getTmdbCredentials();

  if (!credentials) {
    return NextResponse.json({ error: "未配置 TMDB 凭据。" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const region = (searchParams.get("region") || "").trim().toUpperCase();
  const kind = searchParams.get("kind") === "upcoming" ? "upcoming" : "now_playing";
  const localeParam = searchParams.get("locale") || "";
  const locale: Locale = (locales as readonly string[]).includes(localeParam)
    ? (localeParam as Locale)
    : "zh-Hans";
  const pageParam = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(pageParam)
    ? Math.min(MAX_PAGE, Math.max(1, Math.trunc(pageParam)))
    : 1;

  if (!isTmdbRegion(region)) {
    return NextResponse.json({ error: "不支持的地区。" }, { status: 400 });
  }

  try {
    const payload = await fetchTmdbJson<TmdbMovieListResponse>(
      `https://api.themoviedb.org/3/movie/${kind}?region=${region}&page=${page}`,
      credentials,
      getTmdbLanguage(locale),
    );

    const today = new Date().toISOString().slice(0, 10);
    const withPoster = (payload.results || []).filter(
      (movie): movie is Required<Pick<TmdbMovieListResult, "id" | "poster_path" | "release_date">> &
        TmdbMovieListResult =>
        Boolean(movie.id) && Boolean(movie.poster_path) && Boolean(movie.release_date),
    );

    const filtered =
      kind === "upcoming"
        ? withPoster.filter((movie) => movie.release_date >= today)
        : withPoster;

    const sorted = [...filtered].sort((a, b) =>
      kind === "now_playing"
        ? b.release_date.localeCompare(a.release_date)
        : a.release_date.localeCompare(b.release_date),
    );

    const items = sorted.map((movie) => ({
      originalTitle: movie.original_title || movie.title || "",
      posterUrl: getTmdbPosterUrl(movie.poster_path, "w342"),
      releaseDate: movie.release_date,
      title: movie.title || movie.original_title || "",
      tmdbId: movie.id,
      tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    }));

    const totalPages = Math.min(MAX_PAGE, payload.total_pages || 1);

    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        hasMore: page < totalPages,
        items,
        kind,
        page,
        region,
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("[tmdb] now-playing failed", error);

    return NextResponse.json({ error: "无法获取 TMDB 数据。" }, { status: 502 });
  }
}
