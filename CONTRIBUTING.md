# Contributing to Hive Commons Docs

Thank you for helping improve the Hive Commons documentation site
([docs.hivecommons.dev](https://docs.hivecommons.dev)).

- Hive, hotshot, pluk, rationguard, promptargs, dibs, and Spektacular page content is
  synced from the project repositories at build time — edit it there (see
  README "How content is sourced").
- Site code, navigation, and layout changes belong in this repository.
- Sign your commits with the DCO: `git commit -s`.
- Open an issue at https://github.com/hivecommons/docs/issues for anything unclear.

## Before you open a PR

From a fresh checkout, install the exact dependency set and run the local
validation commands that cover the PR gates. You need Node.js 22.19 or newer
(the `engines` field in `package.json`; `.nvmrc` pins 22, which CI also uses):

```bash
npm ci
npm run lint:md      # markdownlint for docs content
npm run type-check    # TypeScript without emitting files
npm test              # Vitest unit tests
npx vitest run --coverage   # what CI runs: tests plus the coverage gate
npm run check-links   # internal docs links
npm run lint          # ESLint for src/, scripts/ and netlify/
npm run format        # Prettier; CI runs format:check, so run this before pushing
npm run build         # production build and doc-sync scripts
```

The Vitest workflow runs `npx vitest run --coverage`, which fails if coverage
falls below the thresholds in `vitest.config.ts` (lines, functions, branches,
statements) across `src/`, `scripts/` and `netlify/`. Add tests alongside new
code in those directories.

To preview the docs locally while editing, run:

```bash
npm run dev
```

Then open the local URL printed by Next.js, usually
<http://localhost:3000>. For a production-style preview, run
`npm run build` followed by `npm run start`.

## Code review requirements

A PR merges once it passes the CI gates defined in `.github/workflows/` — Build,
Internal Links, Markdown Lint, TypeScript & Lint Check, and Vitest — and every
commit is DCO-signed (`git commit -s`).

The PR template's Security Considerations checklist is scoped to this repo's
actual security-sensitive surface: the Netlify serverless function in
`netlify/nps-relay/` (the NPS relay — see the `[functions]` comment in
`netlify.toml`), and dependency bumps (`npm audit`, Dependabot PRs). This repo
has no Dockerfiles or Kubernetes manifests, so those checklist items do not
apply here — leave them unchecked as the template instructs.
