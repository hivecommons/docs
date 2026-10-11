- The daily meeting-recordings refresh PR is now opened with a GitHub App
  token when `MEETING_REFRESH_APP_ID` / `MEETING_REFRESH_APP_PRIVATE_KEY` are
  provisioned, so `Lint and build` and `npm audit` run on its head SHA
  (hivecommons/docs#296). Until then it falls back to `GITHUB_TOKEN`.
