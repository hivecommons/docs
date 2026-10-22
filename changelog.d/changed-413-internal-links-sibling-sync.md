- The Internal Links CI gate now re-syncs sibling-project docs (new
  `sync-sibling-docs` npm script) before checking links, with the same
  non-fatal offline fallback as the Hive sync, so a link regression inside a
  re-rendered sibling page (e.g. an upstream README now pointing at a page
  that no longer exists) is caught on the PR instead of after merge
  (hivecommons/docs#413). A sync source that is itself missing upstream is
  not gated here: the fallback keeps the committed snapshot and the gate
  stays green.
