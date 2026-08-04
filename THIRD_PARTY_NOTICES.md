# Third-party open-source software

This project uses the following direct runtime dependencies and source adaptations:

| Project | License |
| --- | --- |
| React / React DOM | MIT |
| Next.js | MIT |
| hls.js | Apache-2.0 |
| react-markdown | MIT |
| remark-gfm | MIT |
| Sharp | Apache-2.0 |
| Undici | MIT |
| unist-util-visit | MIT |
| Vercel Analytics | MIT |
| Vercel Speed Insights | Apache-2.0 |
| liquid-glass | MIT |

The complete license texts distributed with the application are generated at
[`public/third-party-notices.txt`](public/third-party-notices.txt). After
changing runtime dependencies, regenerate that file with:

```bash
npm run licenses:generate
```

Transitive dependencies remain subject to their own licenses as recorded in
`package-lock.json` and their distributed packages.
