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
validation commands that cover the PR gates:

```bash
npm ci
npm run lint:md      # markdownlint for docs content
npm run type-check    # TypeScript without emitting files
npm test              # Vitest unit tests
npm run check-links   # internal docs links
npm run lint          # ESLint for src/
npm run build         # production build and doc-sync scripts
```

To preview the docs locally while editing, run:

```bash
npm run dev
```

Then open the local URL printed by Next.js, usually
<http://localhost:3000>. For a production-style preview, run
`npm run build` followed by `npm run start`.

