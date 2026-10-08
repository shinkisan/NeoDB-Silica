/**
 * Check the verdict our search box makes against NeoDB's own pattern matching.
 *
 *   npm run catalog-sites:check
 *   npm run catalog-sites:check -- --source ~/src/neodb   # also parity-check
 *
 * Without `--source`/`--ref` this only holds the samples below to their expected
 * site, which catches a regeneration or a matcher change that moves a verdict.
 * With a source it also runs the same samples through Python's `re.match` over
 * upstream's patterns — the anchoring and first-match-wins ordering this file's
 * matcher reproduces — and reports any disagreement.
 *
 * `superset` marks the samples where upstream's fallback validator goes on to do
 * network work a browser can't (a DNS lookup, a page probe), so our pattern-only
 * verdict is deliberately broader there: we ask NeoDB, and NeoDB decides.
 */
import { execFileSync } from "node:child_process";
import { matchCatalogSite } from "../../src/lib/catalog-sites.ts";
import { CATALOG_SITE_RULES } from "../../src/lib/catalog-sites.generated.ts";
import {
  describeSource,
  extractSites,
  parseSitePackageArgs,
  resolveSitesDir,
  type ExtractedSite,
} from "./upstream.ts";

type Sample = {
  expect: string | null;
  superset?: boolean;
  url: string;
};

const SAMPLES: Sample[] = [
  // Covered before this table existed…
  { expect: "IMDB", url: "https://www.imdb.com/title/tt0111161/" },
  { expect: "IMDB", url: "https://m.imdb.com/title/tt0111161" },
  { expect: "DoubanMovie", url: "https://movie.douban.com/subject/1292052/" },
  { expect: "DoubanMovie", url: "https://m.douban.com/movie/subject/1292052" },
  { expect: "DoubanBook", url: "https://book.douban.com/subject/1084336/" },
  { expect: "Spotify_Album", url: "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3" },
  { expect: "Steam", url: "https://store.steampowered.com/app/620/Portal_2/" },
  { expect: "AO3", url: "https://archiveofourown.org/works/12345" },
  { expect: "Goodreads", url: "https://www.goodreads.com/book/show/1234" },
  { expect: "GoogleBooks", url: "https://books.google.com/books?id=abc123" },
  { expect: "Itch", url: "https://itch.io/embed/12345" },
  { expect: "Bandcamp", url: "https://artist.bandcamp.com/album/blue" },

  // …and the sites the old hostname list missed.
  { expect: "AniList_Anime", url: "https://anilist.co/anime/21" },
  { expect: "MAL_Anime", url: "https://myanimelist.net/anime/21" },
  { expect: "BnF", url: "https://catalogue.bnf.fr/ark:/12148/cb12345678x" },
  {
    expect: "RateYourMusic_Release",
    url: "https://rateyourmusic.com/release/album/radiohead/ok-computer/",
  },
  { expect: "MangaUpdates", url: "https://www.mangaupdates.com/series/abc123/title" },
  { expect: "Readmoo", url: "https://readmoo.com/book/210000001000101" },
  {
    expect: "MusicBrainz_ReleaseGroup",
    url: "https://musicbrainz.org/release-group/123e4567-e89b-12d3-a456-426614174000",
  },
  { expect: "TVDB_Series", url: "https://www.thetvdb.com/dereferrer/series/78804" },
  {
    expect: "StoryGraph",
    url: "https://app.thestorygraph.com/books/8f0e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
  },

  // Shapes upstream only accepts after a network check of its own.
  { expect: "TVDB_Series", superset: true, url: "https://www.thetvdb.com/series/breaking-bad" },
  { expect: "Itch", superset: true, url: "https://somegame.itch.io/cool-game" },
  {
    expect: "Bandcamp",
    superset: true,
    url: "https://custom-bandcamp.example/album/blue",
  },

  // Not links to fetch: keyword searches.
  { expect: null, url: "https://www.douban.com/doulist/1234567/" },
  { expect: null, url: "https://www.imdb.com/find?q=matrix" },
  { expect: null, url: "https://example.com/post/1" },
  { expect: null, url: "https://en.wikipedia.org/wiki/NeoDB" },
];

/** Upstream's verdict for each sample, by its own patterns and ordering. */
function upstreamVerdicts(sites: ExtractedSite[], samples: string[]) {
  const script = `
import json, re, sys

data = json.load(sys.stdin)

def verdict(url):
    for site in data["sites"]:
        if any(re.match(pattern, url) for pattern in site["patterns"]):
            return site["idType"]
    for site in data["sites"]:
        for pattern in site["fallbackPatterns"]:
            if re.match(pattern, url):
                return site["idType"]
    return None

print(json.dumps([verdict(url) for url in data["samples"]]))
`;
  const output = execFileSync("python3", ["-c", script], {
    encoding: "utf8",
    input: JSON.stringify({ samples, sites }),
  });

  return JSON.parse(output) as (string | null)[];
}

function verdictOf(url: string) {
  return matchCatalogSite(url)?.idType ?? null;
}

const failures: string[] = [];

for (const sample of SAMPLES) {
  const verdict = verdictOf(sample.url);

  if (verdict !== sample.expect) {
    failures.push(
      `${sample.url}: expected ${sample.expect ?? "no site"}, got ${verdict ?? "no site"}`,
    );
  }
}

if (process.argv.length > 2) {
  const source = parseSitePackageArgs();
  const sites = extractSites(await resolveSitesDir(source));
  const upstream = upstreamVerdicts(
    sites,
    SAMPLES.map((sample) => sample.url),
  );

  SAMPLES.forEach((sample, index) => {
    const theirs = upstream[index];
    const ours = verdictOf(sample.url);

    if (theirs === ours) {
      return;
    }

    if (sample.superset && ours !== null && theirs === null) {
      return;
    }

    failures.push(
      `parity: ${sample.url} — upstream says ${theirs ?? "no site"}, we say ${ours ?? "no site"}`,
    );
  });

  console.log(`parity checked against ${describeSource(source)}`);
}

if (failures.length > 0) {
  console.error(`catalog-sites: ${failures.length} failure(s)`);

  for (const failure of failures) {
    console.error(`  ${failure}`);
  }

  process.exit(1);
}

console.log(
  `catalog-sites: ${SAMPLES.length} samples match, against ${CATALOG_SITE_RULES.length} sites`,
);
