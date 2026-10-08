/**
 * The upstream half of the catalog-sites tooling: where NeoDB's site package
 * comes from, and how it is read back as rules.
 *
 * Shared by `generate.ts` (writes the table the app imports) and `check.ts`
 * (compares our verdict with NeoDB's own pattern matching).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Upstream commit the committed table was generated from. */
export const PINNED_REF = "811753c71dc16b51aa979a845eb8a3cb81f384f9";
export const REPO = "neodb-social/neodb";
export const SITES_PACKAGE = "neodb/catalog/sites";

export type ExtractedSite = {
  className: string;
  fallbackPatterns: string[];
  idType: string;
  module: string;
  patterns: string[];
  siteName: string;
};

export type SitePackageSource = {
  ref: string;
  source: string | null;
};

export function parseSitePackageArgs(): SitePackageSource {
  const args = process.argv.slice(2);
  const source = args.indexOf("--source");
  const ref = args.indexOf("--ref");

  return {
    ref: ref >= 0 ? args[ref + 1] : PINNED_REF,
    source: source >= 0 ? args[source + 1] : null,
  };
}

function moduleNames(initSource: string) {
  return [...initSource.matchAll(/^from \.(\w+) import/gm)].map(
    (match) => match[1],
  );
}

/**
 * A local checkout when one is given, otherwise the files upstream's package is
 * made of — `__init__.py` first, since it lists the modules — fetched at the
 * ref and cached under the OS temp directory.
 */
export async function resolveSitesDir({ ref, source }: SitePackageSource) {
  if (source) {
    return path.join(source, SITES_PACKAGE);
  }

  const dir = path.join(tmpdir(), `app-neodb-sites-${ref}`);

  if (existsSync(path.join(dir, "__init__.py"))) {
    return dir;
  }

  await mkdir(dir, { recursive: true });

  const download = async (file: string) => {
    const response = await fetch(
      `https://raw.githubusercontent.com/${REPO}/${ref}/${SITES_PACKAGE}/${file}`,
    );

    if (!response.ok) {
      throw new Error(`fetch ${file} failed: ${response.status}`);
    }

    return response.text();
  };
  const initSource = await download("__init__.py");

  await writeFile(path.join(dir, "__init__.py"), initSource);

  for (const siteModule of moduleNames(initSource)) {
    await writeFile(
      path.join(dir, `${siteModule}.py`),
      await download(`${siteModule}.py`),
    );
  }

  return dir;
}

export function extractSites(sitesDir: string): ExtractedSite[] {
  const output = execFileSync(
    "python3",
    [path.join(import.meta.dirname, "extract.py"), sitesDir],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  return (JSON.parse(output) as { sites: ExtractedSite[] }).sites;
}

/** How the source should be named in a commit message or a generated header. */
export function describeSource({ ref, source }: SitePackageSource) {
  if (!source) {
    return `${REPO}@${ref}`;
  }

  try {
    const revision = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();

    return `${REPO}@${revision}`;
  } catch {
    return `${source} (unknown revision)`;
  }
}
