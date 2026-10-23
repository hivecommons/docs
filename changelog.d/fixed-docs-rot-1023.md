- Fixed stale Hive content on the site-authored pages: agent-definition YAML
  (v5 `src/examples/agents/` path, `hive.kubestellar.io/v1` apiVersion,
  `kick` is the only channel type), governor (mode is issues + open PRs with
  per-repo threshold scaling), macOS launchd (current Docker Compose
  quickstart, `install -m 600`, `examples/kubestellar-fixer.md`) and
  Spektacular runs (hivecommons install commands, v5 references,
  `just runs-e2e`, spektacular#50 shipped).
- Fixed the footer "Apache 2.0 License", "Security Policy" and "Security
  Contacts" links, which pointed at unpublished `/docs/contributing/...`
  routes; they now open the canonical files on GitHub.
- Fixed relative `<img src="...">` logos in synced sibling READMEs (Dibs,
  Pluk, Promptargs, RationGuard) rendering broken by rewriting them to raw
  GitHub URLs like markdown images.
- Public knowledge MCP page is now synced from `hivecommons/hive@v5` instead of
  a stale local copy.
- Added OpenHands to `llms.txt`; removed unreferenced KubeStellar-era images,
  icons and `common-subs` placeholder pages.
