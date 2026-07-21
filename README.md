# NeoDB Silica

English | [简体中文](./README.zh-Hans.md)

A third-party [NeoDB](https://neodb.net) PWA client designed for phones and
tablets, for discovering and logging books, movies, TV, music, games, and more.
NeoDB Silica is not an official NeoDB app; it uses NeoDB's open APIs to give
your existing NeoDB data a touch-friendly, installable interface. You can
deploy NeoDB Silica against your own NeoDB instance and brand it as your own.

If you're on NeoDB's flagship instance (`neodb.social`), you can directly use
[Bielu](https://bielu.app), maintained by this repository's author — no need
to deploy anything yourself.

If you've deployed NeoDB Silica for any public NeoDB instance and want it
listed below, open an issue in this repository and I'll add it. When branding
your own deployment, please avoid using "Bielu" or a name that could be
confused with it.

Other than bielu.app, deployments listed below are run and maintained
independently by their own operators. Being listed is not an endorsement, and
does not mean this project or its author is responsible for their content,
availability, or data security.

| NeoDB instance | Deployment |
| --- | --- |
| [neodb.social](https://neodb.social) | [bielu.app](https://bielu.app) |

## Features

- Browse and search the NeoDB catalog across every category
- Manage marks, ratings, short comments, long reviews, and personal tags
- Read timelines
- An elegant frosted-glass UI with subtle, restrained interactions. Supports
  custom theme colors and light/dark mode
- Installable PWA
- Optional TMDB enrichment (high-res posters, stills, clickable cast)

## Prerequisites

- Node.js 20+
- A reachable NeoDB instance

## Getting started

1. Clone this repository, then install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

By default the app talks to NeoDB's public flagship instance
(`https://neodb.social`), so you don't need to run your own NeoDB backend to
try it out.

## Configuration

### Environment variables

All runtime/deployment configuration is done through environment variables,
including: the NeoDB instance, session secret, OAuth redirect origin, optional
TMDB, Google Books, and Azure Translator credentials, SEO/indexing, and an
optional outbound proxy. **Secrets belong only in `.env.local`**, which is
gitignored.

`GOOGLE_BOOKS_API_KEY` is optional. When configured, it supplies a fallback
total page count for book reading progress if NeoDB has no page count for that
edition. Without it, users can still enter total pages or chapters manually.

`NEODB_SESSION_SECRET` must be set for login to work.

For security, production deployments must set `NEODB_REDIRECT_ORIGIN` or
`SITE_PUBLIC_ORIGIN` (login is refused otherwise). If you're exposing this
app directly to the internet rather than behind a platform like Vercel, also
set `TRUST_PROXY_HEADERS=0`.

For the full list of environment variables, see
[`.env.example`](./.env.example).

### Branding

Brand identity is intentionally kept out of environment variables. Edit
[`src/site.config.ts`](./src/site.config.ts) — it's the single source for the
site name (drives the PWA manifest, page title, desktop wordmark, and About
page/profile credit line), product description, theme/background colors,
public origin, and feedback contact email (leave it empty to hide the feedback
link); see the comments in that file for how to configure each field.

Then replace the brand assets: `src/app/icon.png` and `public/icons/*`
(favicon, PWA and Apple touch icons).

The About page's per-locale copy (SEO title/description, credit line, button
labels) lives in the `getContent()` function in
[`src/app/about/about-page.tsx`](./src/app/about/about-page.tsx) — edit it
directly for each language you support.

### Featured collections

The home "lists" subtab shows curated collection rails, configured in
[`src/data/featured-collections.json`](./src/data/featured-collections.json).
Each entry in `sections` becomes one horizontal rail:

```json
{
  "sections": [
    {
      "id": "neodb-most-marked",
      "title": "Most marked on NeoDB",
      "collections": [
        {
          "uuid": "7jO1XpuOSfRXbmUKDHKDRP",
          "title": "Most marked books, 2025",
          "url": "https://neodb.social/collection/7jO1XpuOSfRXbmUKDHKDRP"
        }
      ]
    }
  ]
}
```

- `id` — a stable key for the rail; not shown in the UI.
- `title` — the rail's heading, shown as-is.
- `collections[].uuid` — the collection's UUID on **your** configured NeoDB
  instance. This is the field that actually determines what gets fetched and
  rendered.
- `collections[].title` / `url` — for your own reference only, so you can
  find the collection again later. The app always renders the collection's
  live title and cover from NeoDB, not these fields.

When nothing is curated (or none of the configured collections exist on your
instance), the rails and the "lists" subtab are hidden automatically.

## Building

```bash
npm run build
npm run start
```

The app deploys cleanly to Vercel or any Node host that can run
`next build` / `next start`.

## Attribution

- Catalog data and APIs: [NeoDB](https://neodb.net)
- Some movie/TV data: [TMDB](https://www.themoviedb.org) (this product uses the
  TMDB API but is not endorsed or certified by TMDB)
- Translation: Azure Translator
- Glass effects inspired by
  [liquid-glass](https://github.com/nikdelvin/liquid-glass)

## License

[GNU AGPL-3.0-or-later](./LICENSE).

Copyright (C) 2026 NeoDB Silica contributors. This is free software: you can
redistribute it and/or modify it under the terms of the GNU Affero General
Public License. Because it is designed to run as a network service, anyone who
runs a modified version and makes it available to users over a network must
also make the modified source code available to those users.
