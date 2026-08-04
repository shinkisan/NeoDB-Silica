import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPackage = readJson(path.join(root, "package.json"));
const sourceUrls = {
  "@vercel/analytics": "https://github.com/vercel/analytics",
  "@vercel/speed-insights": "https://github.com/vercel/speed-insights",
  "hls.js": "https://github.com/video-dev/hls.js",
  next: "https://github.com/vercel/next.js",
  react: "https://github.com/facebook/react",
  "react-dom": "https://github.com/facebook/react",
  "react-markdown": "https://github.com/remarkjs/react-markdown",
  "remark-gfm": "https://github.com/remarkjs/remark-gfm",
  sharp: "https://github.com/lovell/sharp",
  undici: "https://github.com/nodejs/undici",
  "unist-util-visit": "https://github.com/syntax-tree/unist-util-visit",
};
const licenseNames = ["LICENSE", "LICENSE.md", "license", "license.md"];

const notices = Object.keys(appPackage.dependencies)
  .sort((left, right) => left.localeCompare(right))
  .map((packageName) => {
    const packageRoot = path.join(root, "node_modules", packageName);
    const metadata = readJson(path.join(packageRoot, "package.json"));
    const licensePath = licenseNames
      .map((name) => path.join(packageRoot, name))
      .find((candidate) => fs.existsSync(candidate));

    if (!licensePath) {
      throw new Error(`No license file found for ${packageName}`);
    }

    return formatNotice({
      license: metadata.license || "See included license text",
      licenseText: fs.readFileSync(licensePath, "utf8").trim(),
      name: packageName,
      source: sourceUrls[packageName] || normalizeRepository(metadata.repository),
      version: metadata.version,
    });
  });

notices.push(
  formatNotice({
    license: "MIT",
    licenseText: `MIT License

Copyright (c) 2025 Nikita Stadnik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
    name: "liquid-glass",
    source: "https://github.com/nikdelvin/liquid-glass",
    version: "source adaptation",
  }),
);

const output = `Third-party notices
=============================

This file contains license notices for direct runtime dependencies and source
adaptations used by this application. Transitive dependencies remain subject to their own
licenses as recorded in package-lock.json and their distributed packages.

${notices.join("\n\n")}
`;

fs.writeFileSync(path.join(root, "public", "third-party-notices.txt"), output);
console.log(`Wrote public/third-party-notices.txt (${notices.length} entries)`);

function formatNotice({ license, licenseText, name, source, version }) {
  return `${"=".repeat(78)}
${name} ${version}
License: ${license}
Source: ${source}
${"-".repeat(78)}
${licenseText}`;
}

function normalizeRepository(repository) {
  const value = typeof repository === "string" ? repository : repository?.url;
  return value?.replace(/^git\+/, "").replace(/\.git$/, "") || "Unknown";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
