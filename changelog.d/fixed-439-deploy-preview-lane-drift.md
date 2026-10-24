- CI now rejects Bot-authored PRs whose head branch is not skipped by the Netlify
  deploy-preview ignore rule. The rule also covers `reviewer/*`, `feat/*`,
  `fix/*`, `generated/*`, and `docs-rot-*` branches (#439).
