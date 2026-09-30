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
- **[rationguard](https://github.com/hivecommons/rationguard)** — detect and rebut rationalization patterns in AI agent output
- **[promptargs](https://github.com/hivecommons/promptargs)** — template expansion for AI prompts
- **[dibs](https://github.com/hivecommons/dibs)** — claim ideas so contributors get credit when agents implement them
- **[Spektacular (Spek)](https://github.com/hivecommons/spektacular)** — spec-driven development for AI coding agents (canonical site: [spektacular.dev](https://spektacular.dev))

## How content is sourced

Hive, hotshot, pluk, rationguard, promptargs, dibs, and Spektacular docs are
**single-sourced from their repositories** and pulled at build time:

- `scripts/sync-hive-docs.ts` pulls Hive docs from `hivecommons/hive` (`src/docs/`, branch `v5`;
  override with `HIVE_DOCS_OWNER` / `HIVE_DOCS_REPO` / `HIVE_DOCS_REF`).
- `scripts/sync-sibling-docs.ts` pulls the hotshot, pluk, rationguard, promptargs, dibs, and Spektacular docs from their repos.
  Spektacular also pulls its tutorials from `hivecommons/spektacular-website` (MDX, converted to Markdown by
  `scripts/mdx-to-markdown.ts`; override the ref with `SPEKTACULAR_WEBSITE_DOCS_REF`).
  Override the org for all sibling repos with `SIBLING_DOCS_OWNER` (default `hivecommons`), or the
  branch/ref for an individual project with `HOTSHOT_DOCS_REF`, `PLUK_DOCS_REF`,
  `RATIONGUARD_DOCS_REF`, `PROMPTARGS_DOCS_REF`, `DIBS_DOCS_REF`, or `SPEKTACULAR_DOCS_REF`.

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

## Observability

The site exposes per-instance API metrics via `/api/metrics` in Prometheus text format.
The endpoint serves bounded, in-process counters and histograms for the `search` and
`docs-image` API handlers only (not static assets or page traffic).

**Scope and durability:** The registry is process-local with no configured exporter or
backend. On Netlify, instances are ephemeral, so the `/api/metrics` snapshot is not
durable or site-wide. It is suitable only for immediate, per-instance instrumentation
during development or local testing.

**Site-wide telemetry:** If persistent, aggregated request telemetry is needed, use a
deployment-supported collection path — for example, Netlify's platform-native traffic
analytics, or an explicitly operator-configured scraper/aggregator that polls `/api/metrics`
across instances and persists data to a central observability backend.

## Contributing

PRs welcome. Sign your commits (DCO): `git commit -s`.

## License

Apache 2.0
