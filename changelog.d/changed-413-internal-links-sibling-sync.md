- The Internal Links CI gate now re-syncs sibling-project docs (new
  `sync-sibling-docs` npm script) before checking links, with the same
  non-fatal offline fallback as the Hive sync, so a renamed or removed
  upstream page is caught on the PR instead of after merge (hivecommons/docs#413).
