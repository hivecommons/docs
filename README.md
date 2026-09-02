# Hive Commons Documentation

<p align="center">
  <img src="./public/hive-commons-logo.png" alt="Hive Commons Logo" width="160"/>
</p>

<h2 align="center">Documentation for the Hive Commons projects</h2>

Official documentation site for [Hive Commons](https://hivecommons.dev), served at
[docs.hivecommons.dev](https://docs.hivecommons.dev). It covers:

- **[Hive](https://github.com/hivecommons/hive)** — autonomous AI agent fleets for your repositories
- **[hotshot](https://github.com/hivecommons/hotshot)** — screenshots straight into your AI coding terminal
- **[pluk](https://github.com/hivecommons/pluk)** — pub-sub event streaming for AI agent tmux sessions

## How content is sourced

Hive, hotshot, and pluk docs are **single-sourced from their repositories** and pulled
at build time:

- `scripts/sync-hive-docs.ts` pulls Hive docs from `hivecommons/hive` (`src/docs/`, branch `v4`;
  override with `HIVE_DOCS_OWNER` / `HIVE_DOCS_REPO` / `HIVE_DOCS_REF`).
- `scripts/sync-sibling-docs.ts` pulls hotshot and pluk READMEs from their repos.

Edit the canonical source in the project repository — not the synced copies under
`docs/content/`. If a sync source is unreachable at build time, the committed copies
are used as a fallback.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

The site is Next.js + Nextra, deployed on Netlify (site `hivecommons-docs`).
Navigation is defined in `src/app/docs/page-map.ts`; project registry in
`src/config/versions.ts`.

## Contributing

PRs welcome. Sign your commits (DCO): `git commit -s`.

## License

Apache 2.0
