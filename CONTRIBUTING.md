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

From a fresh checkout, install the exact dependency set and run the same local
validation commands used by CI:

```bash
npm ci
npm run lint
npm run build
```

To preview the docs locally while editing, run:

```bash
npm run dev
```

Then open the local URL printed by Next.js, usually
<http://localhost:3000>. For a production-style preview, run
`npm run build` followed by `npm run start`.

