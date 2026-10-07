- `/api/search` now indexes sibling-project pages (pluk, dibs, hotshot,
  rationguard, promptargs, spektacular) at `/docs/<project>/...`, builds its
  index once per process, and caps `q` at 200 characters
  (hivecommons/docs#262).
