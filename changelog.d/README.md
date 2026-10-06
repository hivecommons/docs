# changelog.d — one changelog fragment per PR

Each user-visible change lands here as **one file per PR** so that two PRs
merging close together never edit the same lines of a shared `CHANGELOG`.
Fragments are grouped into Keep-a-Changelog headings by their filename prefix
when a changelog is rolled up, and `npm test` fails on a malformed fragment
(`scripts/changelog-fragments.test.ts`) so it is caught on the PR instead.

## Format

- **Filename:** `<category>-<slug>.md`, where `<category>` is one of `added`,
  `changed`, `deprecated`, `removed`, `fixed`, `security`, and `<slug>` is
  lowercase `[a-z0-9-]` — a PR/issue number, a short slug, or both:
  `fixed-162-release-channels-raw-markdown.md`.
- **Content:** the entry itself — one or more `- ` bullets (two-space
  continuation lines are fine), ending in a newline. No headings and no bare
  prose: the roll-up owns the `###` headings, your file is the bullet.
- **What qualifies:** user-visible features, fixes, security changes,
  migrations, deprecations. Test-only changes, refactors and dependency churn
  with no visible effect need no fragment.

Example — `changelog.d/fixed-1234-search-index.md`:

```markdown
- `/api/search` now indexes hive-project pages under `docs/content/hive/`
  (hivecommons/docs#1234). Previously they were silently excluded.
```
