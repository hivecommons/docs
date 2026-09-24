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

CI runs these checks on every PR; run them locally first so you catch
failures before pushing:

```bash
npm run lint:md      # markdownlint-cli2 on README, CONTRIBUTING, and docs content
npm run type-check    # tsc --noEmit
npm test              # vitest run
npm run check-links   # validates internal doc links
npm run lint          # eslint on src/
```

`npm run build` also exercises the doc-sync scripts (`sync-hive-docs`,
`sync-sibling-docs`) and is worth running if you changed anything under
`scripts/`.
