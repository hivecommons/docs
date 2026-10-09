# Docs API alerts

Use this when one of the rules in `monitoring/docs-api-alerts.yml` fires. The
metrics come from `/api/metrics` (`src/lib/metrics.ts`).

## DocsApiHealthzFailing

`/api/healthz` returns 503 when the docs content tree (`docsContentPath` in
`src/app/docs/page-map.ts`) is missing, not a directory, empty, or unreadable.
Pages and `/api/search` read from it, so readers see empty or broken docs.

1. Open `/api/healthz` on the live site and read the `error` reason; the same
   reason is logged as `healthz check failed`.
2. If the last deploy introduced it, restore the previous deploy with
   [site-rollback.md](site-rollback.md).
3. If the content tree is incomplete, fix the sync source or the committed
   content and redeploy. Do not hand-edit synced content under `docs/`.
4. Confirm the alert clears once `/api/healthz` returns 200 for 5 minutes.

## DocsApiHighErrorRate

More than 5% of requests on one `route` label are returning 5xx.

1. Identify the route from the alert label (`search`, `healthz`, `metrics`,
   `docs-image`) and find matching error logs.
2. Correlate with the most recent deploy; if it lines up, roll back with
   [site-rollback.md](site-rollback.md).
3. Otherwise fix forward in a DCO-signed PR (`git commit -s`).

## DocsApiSlowRequests

p95 latency on a route has exceeded 2.5s for 15 minutes.

1. Check which route is labelled; `search` is the most likely, as it reads
   markdown from disk per request.
2. Check for a recent content-size or dependency change in the last deploy and
   roll back if it correlates.
3. Do not raise the threshold to silence the alert; fix the cause.
