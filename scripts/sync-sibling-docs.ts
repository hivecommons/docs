/**
 * Sync hotshot and pluk docs from their GitHub repos into docs/content/.
 *
 * Same single-sourcing model as scripts/sync-hive-docs.ts: the repos own the
 * markdown; this script pulls it at build time (prebuild) so the site never
 * drifts from the source. Only readme.md is required per project — optional
 * pages that 404 are skipped with a warning so a repo layout change cannot
 * break the docs build.
 */
import fs from "fs";
import path from "path";

interface SyncedFile {
  source: string; // path in the source repo
  target: string; // filename under docs/content/<project>/
  required?: boolean;
}

interface ProjectSync {
  project: string; // docs/content/<project> and /docs/<project> route base
  owner: string;
  repo: string;
  branch: string;
  files: SyncedFile[];
}

const PROJECTS: ProjectSync[] = [
  {
    project: "hotshot",
    owner: process.env.SIBLING_DOCS_OWNER || "hivecommons",
    repo: "hotshot",
    branch: process.env.HOTSHOT_DOCS_REF || "main",
    files: [
      { source: "README.md", target: "readme.md", required: true },
      { source: "linux/README.md", target: "linux.md" },
      { source: "windows/README.md", target: "windows.md" },
    ],
  },
  {
    project: "pluk",
    owner: process.env.SIBLING_DOCS_OWNER || "hivecommons",
    repo: "pluk",
    branch: process.env.PLUK_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
];

function syncedHeader(p: ProjectSync, source: string): string {
  const canonical = `https://github.com/${p.owner}/${p.repo}/blob/${p.branch}/${source}`;
  return `> **Synced from ${p.repo}.** This page is pulled from [${p.owner}/${p.repo}@${p.branch}](${canonical}) during the docs build. Edit the canonical source in the ${p.repo} repository.\n\n`;
}

/**
 * Rewrite links authored for GitHub's file browser:
 *  - a relative link to a markdown file that IS synced here becomes the
 *    site-absolute extension-less route (/docs/<project>/<target-sans-md>)
 *  - any other relative link (source files, directories, unsynced markdown)
 *    becomes an absolute GitHub URL so it keeps working
 *  - relative image sources become raw.githubusercontent URLs
 *  - absolute URLs and pure anchors are left untouched
 */
function rewriteLinks(content: string, p: ProjectSync): string {
  const syncedRoutes = new Map<string, string>();
  for (const f of p.files) {
    syncedRoutes.set(
      f.source.toLowerCase(),
      `/docs/${p.project}/${f.target.replace(/\.md$/i, "")}`
    );
  }
  const blobBase = `https://github.com/${p.owner}/${p.repo}/blob/${p.branch}`;
  const rawBase = `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${p.branch}`;

  return content.replace(
    /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g,
    (match, bang: string, text: string, href: string) => {
      if (/^(https?:|mailto:|#|\/)/i.test(href)) return match;
      const clean = href.replace(/^\.\//, "");
      if (bang === "!") return `![${text}](${rawBase}/${clean})`;
      const [linkPath, anchor] = clean.split("#");
      const route = syncedRoutes.get(linkPath.toLowerCase());
      if (route) return `[${text}](${route}${anchor ? `#${anchor}` : ""})`;
      return `[${text}](${blobBase}/${clean})`;
    }
  );
}

async function fetchFile(p: ProjectSync, source: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${p.branch}/${source}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

async function main() {
  for (const p of PROJECTS) {
    const outDir = path.join(process.cwd(), "docs", "content", p.project);
    fs.mkdirSync(outDir, { recursive: true });

    for (const f of p.files) {
      const body = await fetchFile(p, f.source);
      if (body === null) {
        const msg = `sync-sibling-docs: ${p.owner}/${p.repo}@${p.branch}/${f.source} not found`;
        if (f.required) throw new Error(msg);
        console.warn(`${msg} — skipped`);
        continue;
      }
      const out = syncedHeader(p, f.source) + rewriteLinks(body, p);
      fs.writeFileSync(path.join(outDir, f.target), out);
      console.log(`synced ${p.project}/${f.target} <- ${p.owner}/${p.repo}/${f.source}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
