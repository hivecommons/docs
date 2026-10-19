- `scripts/sync-sibling-docs.ts` now strips `.mdx` as well as `.md` when
  mapping a synced page to its `/docs/<project>/…` route, so links to pages
  synced as MDX no longer resolve to `/docs/<project>/<page>.mdx`
  (hivecommons/docs#355).
