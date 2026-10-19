- The daily meeting-recordings refresh workflow no longer needs a GitHub App
  (`MEETING_REFRESH_APP_ID` / `MEETING_REFRESH_APP_PRIVATE_KEY`). After pushing
  the PR branch it dispatches Build, TypeScript & Lint Check, Vitest and npm
  audit on that branch via `workflow_dispatch`, so the required status checks
  land on the head SHA even though the PR is opened with `GITHUB_TOKEN`
  (hivecommons/docs#335, hivecommons/docs#337).
