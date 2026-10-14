- `netlify.toml` is now covered by the vitest gate (hivecommons/docs#332): every
  project in `src/config/versions.ts` must have its `/docs/<id>` and
  `/docs/<id>/` landing redirects, stale or duplicate `/docs/*` rules fail, and
  re-adding the documented catch-all `/*` 404 rule fails the PR instead of
  taking the deployed site down.
