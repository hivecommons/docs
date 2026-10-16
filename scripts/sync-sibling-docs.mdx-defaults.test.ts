import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSync } from "./sync-sibling-docs";

// Covers the `mdx` rendering defaults in scripts/sync-sibling-docs.ts that the
// shipped PROJECTS table never exercises: every mdx entry there sets both
// `siteBase` and `assetsRoot`, so the `?? ""` fallbacks in copyAssets() and
// renderPage() — and the direct-run guard's `process.argv[1] ?? ""` — are
// otherwise unreachable.
//
// main() is not exported, and the module runs it on import. To feed it a
// project of our own we hold the very first fetch on a gate, push the extra
// project onto the (live) PROJECTS array the running main() is iterating,
// then release the gate. `for...of` over an array reads by index, so the
// pushed entry is visited after the shipped ones.

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "sync-sibling-docs.ts");
const workRoot = path.join(
  repoRoot,
  ".test-work",
  "sync-sibling-docs-mdx-defaults"
);

const png = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");

const EXTRA_PROJECT: ProjectSync = {
  owner: "hivecommons",
  repo: "zeta-site",
  branch: "main",
  project: "zeta",
  files: [
    {
      source: "content/guide.mdx",
      target: "guide.md",
      format: "mdx",
      // Deliberately no siteBase / assetsRoot.
    },
  ],
};

const GUIDE_MDX = [
  "---",
  "title: Guide",
  "---",
  "",
  "![ok](/images/ok.png)",
  "",
  "![missing](/images/missing.png)",
  "",
  "![escape](/images/../../escape.png)",
  "",
  "See the [install page](/install/).",
  "",
].join("\n");

let caseDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let origArgv1: string | undefined;
let origFetch: typeof globalThis.fetch;
let fetchedUrls: string[];

type Responses = Record<string, string | { binary: string }>;

function joinCalls(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map(c => c.map(String).join(" ")).join("\n");
}

/**
 * Serve `responses` keyed by the raw.githubusercontent path after the host.
 * The first request blocks until `release()` is called so the test can mutate
 * PROJECTS before main() moves past the first file.
 */
function stubGatedFetch(responses: Responses): { release: () => void } {
  fetchedUrls = [];
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let first = true;
  globalThis.fetch = (async (input: string | URL | Request) => {
    if (first) {
      first = false;
      await gate;
    }
    const u = String(input instanceof Request ? input.url : input);
    fetchedUrls.push(u);
    const key = u.replace("https://raw.githubusercontent.com/", "");
    const hit = responses[key];
    if (hit === undefined) {
      return new Response("missing", { status: 404, statusText: "Not Found" });
    }
    if (typeof hit === "string") return new Response(hit, { status: 200 });
    return new Response(Buffer.from(hit.binary, "base64"), { status: 200 });
  }) as typeof fetch;
  return { release };
}

async function importFresh(): Promise<typeof import("./sync-sibling-docs")> {
  vi.resetModules();
  return import("./sync-sibling-docs");
}

/** Required readmes for every shipped project so main() reaches ours. */
function shippedReadmes(projects: ProjectSync[]): Responses {
  const r: Responses = {};
  for (const p of projects) {
    for (const f of p.files) {
      if (!f.required) continue;
      const repo = f.repo ?? p;
      r[`${repo.owner}/${repo.repo}/${repo.branch}/${f.source}`] =
        `# ${p.project}\n`;
    }
  }
  return r;
}

beforeEach(() => {
  fs.mkdirSync(workRoot, { recursive: true });
  caseDir = fs.mkdtempSync(path.join(workRoot, "case-"));
  origFetch = globalThis.fetch;
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(caseDir);
  origArgv1 = process.argv[1];
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = origFetch;
  cwdSpy.mockRestore();
  exitSpy.mockRestore();
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errSpy.mockRestore();
  if (origArgv1 === undefined) {
    delete (process.argv as unknown as Record<number, string>)[1];
  } else {
    process.argv[1] = origArgv1;
  }
  fs.rmSync(caseDir, { recursive: true, force: true });
});

describe("sync-sibling-docs direct-run guard", () => {
  it("does not start the sync when process.argv[1] is undefined", async () => {
    delete (process.argv as unknown as Record<number, string>)[1];
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response("", { status: 404 });
    }) as typeof fetch;

    await importFresh();
    // Give any accidental main() a chance to issue its first request.
    await new Promise(r => setTimeout(r, 20));

    expect(calls).toEqual([]);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe("mdx pages without siteBase / assetsRoot", () => {
  it("resolves assets from the repo root and leaves unfetched images site-relative", async () => {
    process.argv[1] = scriptPath;

    // Build the response table from a throwaway import of the module so it
    // matches whatever PROJECTS ships; the gated run below re-imports.
    const probe = await importFresh();
    const responses = shippedReadmes(probe.PROJECTS);
    responses["hivecommons/zeta-site/main/content/guide.mdx"] = GUIDE_MDX;
    // No assetsRoot: `/images/ok.png` is looked up at the repo root.
    responses["hivecommons/zeta-site/main/images/ok.png"] = { binary: png };
    const { release } = stubGatedFetch(responses);

    const mod = await importFresh();
    mod.PROJECTS.push(EXTRA_PROJECT);
    release();

    await vi.waitFor(
      () => {
        const done =
          exitSpy.mock.calls.length > 0 ||
          joinCalls(logSpy).includes("synced zeta/guide.md");
        if (!done) throw new Error("sync still running");
      },
      { timeout: 5_000, interval: 5 }
    );

    expect(exitSpy).not.toHaveBeenCalled();
    expect(joinCalls(errSpy)).toBe("");

    // assetsRoot defaulted to "" → fetched from <repo>/images/ok.png, not
    // <repo>/public/images/ok.png.
    expect(fetchedUrls).toContain(
      "https://raw.githubusercontent.com/hivecommons/zeta-site/main/images/ok.png"
    );
    expect(fetchedUrls.some(u => u.includes("/public/"))).toBe(false);
    expect(fetchedUrls.some(u => u.includes("escape.png"))).toBe(false);

    const copied = path.join(
      caseDir,
      "docs",
      "content",
      "zeta",
      "images",
      "ok.png"
    );
    expect(fs.existsSync(copied)).toBe(true);
    expect(fs.readFileSync(copied).toString("base64")).toBe(png);

    const page = fs.readFileSync(
      path.join(caseDir, "docs", "content", "zeta", "guide.md"),
      "utf8"
    );
    expect(page).toContain("![ok](images/ok.png)");
    // siteBase defaulted to "" → a missing image and a refused traversal both
    // keep their bare site-absolute path with no origin prefixed.
    expect(page).toContain("![missing](/images/missing.png)");
    expect(page).toContain("![escape](/images/../../escape.png)");
    expect(page).toContain("[install page](/install/)");
    // Header falls back to the GitHub source when neither siteBase nor
    // canonicalSite is set.
    expect(page).toContain("Synced from zeta-site.");
    expect(page).not.toContain("undefined");

    const warn = joinCalls(warnSpy);
    expect(warn).toContain(
      "hivecommons/zeta-site@main/images/missing.png not found"
    );
    expect(warn).toContain("refusing to copy /images/../../escape.png outside");
    expect(fs.existsSync(path.join(caseDir, "escape.png"))).toBe(false);
  });
});
