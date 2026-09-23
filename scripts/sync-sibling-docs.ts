/**
 * Sync hotshot, pluk, rationguard, promptargs, and Spektacular docs from their GitHub repos into docs/content/.
 *
 * Same single-sourcing model as scripts/sync-hive-docs.ts: the repos own the
 * markdown; this script pulls it at build time (prebuild) so the site never
 * drifts from the source. Only readme.md is required per project — optional
 * pages that 404 are skipped with a warning so a repo layout change cannot
 * break the docs build.
 *
 * A project may pull pages from more than one repository (Spektacular's
 * tutorials live in the spektacular-website Astro site), and a page may be
 * authored as MDX, in which case it is converted to plain Markdown by
 * scripts/mdx-to-markdown.ts and the images it references are copied next to
 * the synced page.
 */
import fs from "fs";
import path from "path";
import { normalizeFences } from "./markdown-fences";
import { convertMdxToMarkdown } from "./mdx-to-markdown";

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface SyncedFile {
  source: string; // path in the source repo
  target: string; // filename under docs/content/<project>/
  required?: boolean;
  /** Pull this page from a different repository than the project default. */
  repo?: RepoRef;
  /** `mdx` pages are converted to Markdown; `md` (default) pages are copied. */
  format?: "md" | "mdx";
  /**
   * For `mdx` pages: the canonical site the page is published on. Site-absolute
   * links (`/install/`) are rewritten to this origin and the page header
   * points readers at it.
   */
  siteBase?: string;
  /** For `mdx` pages: path of the page on `siteBase`, e.g. /tutorials/getting-started/. */
  sitePath?: string;
  /**
   * For `mdx` pages: directory in the source repo that site-absolute asset
   * paths (`/images/...`) resolve under, e.g. `public`. Referenced images are
   * copied into docs/content/<project>/ at the same relative path.
   */
  assetsRoot?: string;
}

export interface ProjectSync extends RepoRef {
  project: string; // docs/content/<project> and /docs/<project> route base
  /** Canonical site for the project, shown on the overview page when set. */
  canonicalSite?: string;
  files: SyncedFile[];
}

const SIBLING_OWNER = process.env.SIBLING_DOCS_OWNER || "hivecommons";
const SPEKTACULAR_SITE = "https://spektacular.dev";

const SPEKTACULAR_WEBSITE: RepoRef = {
  owner: SIBLING_OWNER,
  repo: "spektacular-website",
  branch: process.env.SPEKTACULAR_WEBSITE_DOCS_REF || "main",
};

export const PROJECTS: ProjectSync[] = [
  {
    project: "hotshot",
    owner: SIBLING_OWNER,
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
    owner: SIBLING_OWNER,
    repo: "pluk",
    branch: process.env.PLUK_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
  {
    project: "rationguard",
    owner: SIBLING_OWNER,
    repo: "rationguard",
    branch: process.env.RATIONGUARD_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
  {
    project: "promptargs",
    owner: SIBLING_OWNER,
    repo: "promptargs",
    branch: process.env.PROMPTARGS_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
  {
    // Canonical site is https://spektacular.dev. The repo README and
    // docs/knowledge-base.md come from the spektacular repo; the tutorials are
    // authored as MDX in the spektacular-website Astro site.
    project: "spektacular",
    owner: SIBLING_OWNER,
    repo: "spektacular",
    branch: process.env.SPEKTACULAR_DOCS_REF || "main",
    canonicalSite: SPEKTACULAR_SITE,
    files: [
      { source: "README.md", target: "readme.md", required: true },
      { source: "docs/knowledge-base.md", target: "knowledge-base.md" },
      {
        source: "src/content/tutorials/getting-started.mdx",
        target: "getting-started.md",
        repo: SPEKTACULAR_WEBSITE,
        format: "mdx",
        siteBase: SPEKTACULAR_SITE,
        sitePath: "/tutorials/getting-started/",
        assetsRoot: "public",
      },
      {
        source: "src/content/tutorials/unknown-criteria.mdx",
        target: "unknown-criteria.md",
        repo: SPEKTACULAR_WEBSITE,
        format: "mdx",
        siteBase: SPEKTACULAR_SITE,
        sitePath: "/tutorials/unknown-criteria/",
        assetsRoot: "public",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Brand scrub
// ---------------------------------------------------------------------------
// The source repos predate the Hive Commons migration and still carry
// KubeStellar-era identifiers. Rewrite them until the upstream repos are
// scrubbed, so the published site never shows the old branding.
export function scrubLegacyBranding(content: string): string {
  return content
    .replace(/io\.kubestellar\.hive\./g, "io.hivecommons.hive.")
    .replace(/hive\\?\.kubestellar\\?\.io/g, (m) =>
      m.includes("\\") ? "hive\\.hivecommons\\.dev" : "hive.hivecommons.dev")
    .replace(/examples\/kubestellar-fixer\.md/g, "examples/hivecommons-fixer.md")
    .replace(/examples\/kubestellar\//g, "examples/hivecommons/")
    .replace(/@kubestellar\//g, "@hivecommons/")
    .replace(/github\.com\/kubestellar\/hive/g, "github.com/hivecommons/hive")
    .replace(/github\.com\/kubestellar/g, "github.com/hivecommons")
    .replace(/kubestellar\/hive/g, "hivecommons/hive")
    .replace(/kubestellar\/pluk/g, "hivecommons/pluk")
    .replace(/kubestellar\/hotshot/g, "hivecommons/hotshot")
    // Spektacular transferred from jumppad-labs. Only rewrite repo sub-paths
    // (releases, issues, blob): the Go module path is still
    // github.com/jumppad-labs/spektacular and the Homebrew tap still lives
    // under jumppad-labs, so `go install ...@latest` and `brew install` must
    // keep their original targets. Other jumppad-labs repos (the tutorial's
    // example project) were not transferred and keep their URLs.
    .replace(/github\.com\/jumppad-labs\/spektacular\//g, "github.com/hivecommons/spektacular/")
    .replace(/github\.com\/jumppad-labs\/spektacular-website\//g, "github.com/hivecommons/spektacular-website/")
    .replace(/kubestellar\.io/g, "hivecommons.dev")
    .replace(/KubeStellar/g, "Hive Commons")
    .replace(/Kubestellar/g, "Hive Commons")
    .replace(/kubestellar/g, "hivecommons");
}

function fileRepo(p: ProjectSync, f: SyncedFile): RepoRef {
  return f.repo ?? { owner: p.owner, repo: p.repo, branch: p.branch };
}

export function syncedHeader(p: ProjectSync, f: SyncedFile): string {
  const r = fileRepo(p, f);
  const canonical = `https://github.com/${r.owner}/${r.repo}/blob/${r.branch}/${f.source}`;
  let header = `> **Synced from ${r.repo}.** This page is pulled from [${r.owner}/${r.repo}@${r.branch}](${canonical}) during the docs build. Edit the canonical source in the ${r.repo} repository.`;
  const site = f.siteBase ?? p.canonicalSite;
  if (site) {
    const pageUrl = f.sitePath ? `${site.replace(/\/$/, "")}${f.sitePath}` : site;
    const host = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
    header += `\n>\n> Also published at [${host}](${pageUrl}), which is the canonical copy of this documentation.`;
  }
  return header + "\n\n";
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
export function rewriteLinks(content: string, p: ProjectSync, f?: SyncedFile): string {
  const syncedRoutes = new Map<string, string>();
  for (const s of p.files) {
    syncedRoutes.set(
      s.source.toLowerCase(),
      `/docs/${p.project}/${s.target.replace(/\.md$/i, "")}`
    );
  }
  const r = f ? fileRepo(p, f) : p;
  const blobBase = `https://github.com/${r.owner}/${r.repo}/blob/${r.branch}`;
  const rawBase = `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${r.branch}`;

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

function rawUrl(r: RepoRef, source: string): string {
  return `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${r.branch}/${source}`;
}

async function fetchFile(r: RepoRef, source: string): Promise<string | null> {
  const res = await fetch(rawUrl(r, source));
  if (!res.ok) return null;
  return res.text();
}

async function fetchBinary(r: RepoRef, source: string): Promise<Buffer | null> {
  const res = await fetch(rawUrl(r, source));
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Copy the site-absolute images an MDX page references into the project's
 * content folder so they are served by the docs-image route. Images that
 * cannot be fetched keep an absolute URL on the canonical site instead.
 */
async function copyAssets(
  p: ProjectSync,
  f: SyncedFile,
  images: string[],
  outDir: string
): Promise<Map<string, string>> {
  const rewritten = new Map<string, string>();
  const r = fileRepo(p, f);
  for (const img of images) {
    if (rewritten.has(img)) continue;
    const rel = img.replace(/^\/+/, "");
    const dest = path.resolve(outDir, rel);
    if (!dest.startsWith(path.resolve(outDir) + path.sep)) {
      console.warn(`sync-sibling-docs: refusing to copy ${img} outside ${outDir}`);
      rewritten.set(img, `${f.siteBase ?? ""}${img}`);
      continue;
    }
    const source = path.posix.join(f.assetsRoot ?? "", rel);
    const bytes = await fetchBinary(r, source);
    if (bytes === null) {
      console.warn(`sync-sibling-docs: ${r.owner}/${r.repo}@${r.branch}/${source} not found — linking to ${f.siteBase}${img}`);
      rewritten.set(img, `${f.siteBase ?? ""}${img}`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
    rewritten.set(img, rel);
  }
  return rewritten;
}

async function renderPage(p: ProjectSync, f: SyncedFile, body: string, outDir: string): Promise<string> {
  if (f.format === "mdx") {
    // First pass collects the image list; assets are copied and the src
    // values are rewritten in a second pass with the resolved locations.
    const probe = convertMdxToMarkdown(body, { siteBase: f.siteBase ?? "" });
    const assets = await copyAssets(p, f, probe.images, outDir);
    const conv = convertMdxToMarkdown(body, {
      siteBase: f.siteBase ?? "",
      rewriteImage: (src) => assets.get(src) ?? src.replace(/^\//, ""),
    });
    for (const note of conv.notes) {
      console.warn(`sync-sibling-docs: ${p.project}/${f.target}: ${note}`);
    }
    return conv.markdown;
  }
  return rewriteLinks(body, p, f);
}

async function main() {
  for (const p of PROJECTS) {
    const outDir = path.join(process.cwd(), "docs", "content", p.project);
    fs.mkdirSync(outDir, { recursive: true });

    for (const f of p.files) {
      const r = fileRepo(p, f);
      const body = await fetchFile(r, f.source);
      if (body === null) {
        const msg = `sync-sibling-docs: ${r.owner}/${r.repo}@${r.branch}/${f.source} not found`;
        if (f.required) throw new Error(msg);
        console.warn(`${msg} — skipped`);
        continue;
      }
      const page = await renderPage(p, f, body, outDir);
      const out = syncedHeader(p, f) + normalizeFences(scrubLegacyBranding(page));
      fs.writeFileSync(path.join(outDir, f.target), out);
      console.log(`synced ${p.project}/${f.target} <- ${r.owner}/${r.repo}/${f.source}`);
    }
  }
}

// Only run the sync when this file is executed directly (not when imported by
// the test suite, which would otherwise trigger network fetches on import).
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /sync-sibling-docs\.ts$/.test(process.argv[1] ?? "");

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
