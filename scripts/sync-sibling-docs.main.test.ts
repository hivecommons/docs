import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECTS, introduceSpekStyle } from "./sync-sibling-docs";

// Drives the script's main() end to end the same way `npm run prebuild` does:
// spawn it under tsx with a `--import` preload that replaces globalThis.fetch,
// so no network is touched and every fetch outcome (text, binary, 404) is
// scripted per URL.

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "sync-sibling-docs.ts");
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");
const workRoot = path.join(repoRoot, ".test-work", "sync-sibling-docs");

let caseDir: string;

type Responses = Record<string, string | { binary: string }>;

/**
 * Build a preload that serves `responses` keyed by the raw.githubusercontent
 * path after the branch segment (e.g. "hivecommons/pluk/main/README.md").
 * Any URL not listed answers 404. Every fetched URL is appended to
 * `fetched.log` in the case dir so tests can assert what main() asked for.
 */
function writeFetchStub(responses: Responses): string {
  const preloadPath = path.join(caseDir, "fetch-stub.mjs");
  const logPath = path.join(caseDir, "fetched.log");
  fs.writeFileSync(
    preloadPath,
    `import fs from "node:fs";
const responses = ${JSON.stringify(responses)};
globalThis.fetch = async (url) => {
  const u = String(url);
  fs.appendFileSync(${JSON.stringify(logPath)}, u + "\\n");
  const key = u.replace("https://raw.githubusercontent.com/", "");
  const hit = responses[key];
  if (hit === undefined) return { ok: false, status: 404 };
  if (typeof hit === "string") return { ok: true, status: 200, text: async () => hit };
  const buf = Buffer.from(hit.binary, "base64");
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};
`
  );
  return preloadPath;
}

function runSync(preloadPath: string) {
  return spawnSync(tsxBin, [scriptPath], {
    cwd: caseDir,
    env: { ...process.env, NODE_OPTIONS: `--import ${preloadPath}` },
    encoding: "utf8",
    timeout: 60_000,
  });
}

function fetched(): string[] {
  const logPath = path.join(caseDir, "fetched.log");
  return fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf8").trim().split("\n")
    : [];
}

function outPath(project: string, target: string): string {
  return path.join(caseDir, "docs", "content", project, target);
}

/** Minimal response set: every required readme answers so main() completes. */
function allReadmes(): Responses {
  const r: Responses = {};
  for (const p of PROJECTS) {
    for (const f of p.files) {
      if (!f.required) continue;
      const repo = f.repo ?? p;
      r[`${repo.owner}/${repo.repo}/${repo.branch}/${f.source}`] =
        `# ${p.project}\n\nSee [guide](docs/GUIDE.md).\n`;
    }
  }
  return r;
}

beforeEach(() => {
  fs.mkdirSync(workRoot, { recursive: true });
  caseDir = fs.mkdtempSync(path.join(workRoot, "case-"));
});

afterEach(() => {
  fs.rmSync(caseDir, { recursive: true, force: true });
});

describe("sync-sibling-docs main()", () => {
  it("fails the build when a required readme is missing", () => {
    const responses = allReadmes();
    delete responses["hivecommons/pluk/main/README.md"];
    const res = runSync(writeFetchStub(responses));

    expect(res.status).toBe(1);
    expect(res.stderr).toContain("hivecommons/pluk@main/README.md not found");
    // hotshot (listed before pluk) was still written; nothing after pluk was attempted.
    expect(fs.existsSync(outPath("hotshot", "readme.md"))).toBe(true);
    expect(fs.existsSync(outPath("rationguard", "readme.md"))).toBe(false);
  });

  it("skips optional pages that 404 with a warning and writes the rest", () => {
    const res = runSync(writeFetchStub(allReadmes()));

    expect(res.status).toBe(0);
    expect(res.stderr).toContain(
      "hivecommons/hotshot@main/linux/README.md not found — skipped"
    );
    expect(res.stderr).toContain(
      "hivecommons/spektacular@main/docs/knowledge-base.md not found — skipped"
    );
    for (const p of PROJECTS) {
      expect(fs.existsSync(outPath(p.project, "readme.md"))).toBe(true);
    }
    expect(fs.existsSync(outPath("hotshot", "linux.md"))).toBe(false);
    expect(fs.existsSync(outPath("spektacular", "getting-started.md"))).toBe(
      false
    );
    expect(res.stdout).toContain(
      "synced pluk/readme.md <- hivecommons/pluk/README.md"
    );
  });

  it("writes markdown pages with the synced header and rewritten links", () => {
    const responses = allReadmes();
    responses["hivecommons/pluk/main/ROADMAP.md"] =
      "# Roadmap\n\nBack to the [readme](README.md#install) or [source](src/main.go).\n";
    const res = runSync(writeFetchStub(responses));

    expect(res.status).toBe(0);
    const roadmap = fs.readFileSync(outPath("pluk", "roadmap.md"), "utf8");
    expect(
      roadmap.startsWith(
        "> **Synced from pluk.** This page is pulled from [hivecommons/pluk@main](https://github.com/hivecommons/pluk/blob/main/ROADMAP.md)"
      )
    ).toBe(true);
    expect(roadmap).toContain("[readme](/docs/pluk/readme#install)");
    expect(roadmap).toContain(
      "[source](https://github.com/hivecommons/pluk/blob/main/src/main.go)"
    );
  });

  it("honours *_DOCS_REF overrides when choosing the branch to fetch", () => {
    const responses = allReadmes();
    delete responses["hivecommons/pluk/main/README.md"];
    responses["hivecommons/pluk/v2/README.md"] = "# pluk v2\n";
    const preload = writeFetchStub(responses);
    const res = spawnSync(tsxBin, [scriptPath], {
      cwd: caseDir,
      env: {
        ...process.env,
        NODE_OPTIONS: `--import ${preload}`,
        PLUK_DOCS_REF: "v2",
      },
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(res.status).toBe(0);
    expect(fetched()).toContain(
      "https://raw.githubusercontent.com/hivecommons/pluk/v2/README.md"
    );
    expect(fs.readFileSync(outPath("pluk", "readme.md"), "utf8")).toContain(
      "hivecommons/pluk@v2"
    );
  });

  describe("mdx pages from spektacular-website", () => {
    const png = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
    const mdx = [
      "---",
      "title: Getting started",
      "summary: First steps",
      "---",
      "",
      "![ok](/images/tutorials/ok.png)",
      "",
      "![missing](/images/tutorials/missing.png)",
      "",
      "![escape](/images/../../escape.png)",
      "",
      "Read the [guide](/guides/knowledge-base/).",
      "",
    ].join("\n");

    it("copies fetched images beside the page, links missing ones to the site, and refuses traversal", () => {
      const responses = allReadmes();
      responses[
        "hivecommons/spektacular-website/main/src/content/tutorials/getting-started.mdx"
      ] = mdx;
      responses[
        "hivecommons/spektacular-website/main/public/images/tutorials/ok.png"
      ] = { binary: png };
      const res = runSync(writeFetchStub(responses));

      expect(res.status).toBe(0);

      const copied = path.join(
        caseDir,
        "docs",
        "content",
        "spektacular",
        "images",
        "tutorials",
        "ok.png"
      );
      expect(fs.existsSync(copied)).toBe(true);
      expect(fs.readFileSync(copied).toString("base64")).toBe(png);

      const page = fs.readFileSync(
        outPath("spektacular", "getting-started.md"),
        "utf8"
      );
      expect(page).toContain("![ok](images/tutorials/ok.png)");
      expect(page).toContain(
        "![missing](https://spektacular.dev/images/tutorials/missing.png)"
      );
      expect(page).toContain(
        "![escape](https://spektacular.dev/images/../../escape.png)"
      );
      expect(page).toContain(
        "[guide](https://spektacular.dev/guides/knowledge-base/)"
      );
      expect(page).toContain("Synced from spektacular-website.");

      expect(res.stderr).toContain(
        "public/images/tutorials/missing.png not found — linking to https://spektacular.dev/images/tutorials/missing.png"
      );
      expect(res.stderr).toContain(
        "refusing to copy /images/../../escape.png outside"
      );

      // The traversal candidate is never fetched and never lands on disk.
      expect(fetched().some(u => u.includes("escape.png"))).toBe(false);
      expect(fs.existsSync(path.join(caseDir, "escape.png"))).toBe(false);
      expect(fs.existsSync(path.join(caseDir, "docs", "escape.png"))).toBe(
        false
      );
    });
  });
});

describe("introduceSpekStyle", () => {
  it("leaves non-spektacular projects untouched", () => {
    const src = "Spektacular turns it into a plan.";
    expect(introduceSpekStyle("pluk", "readme.md", src)).toBe(src);
  });

  it("leaves spektacular targets with no replacement table untouched", () => {
    const src = "Spektacular turns it into a plan.";
    expect(introduceSpekStyle("spektacular", "knowledge-base.md", src)).toBe(
      src
    );
  });

  it("rewrites prose on the spektacular readme while keeping command names", () => {
    const src = [
      "Spektacular turns it into a plan.",
      "the central `spec`, `plan`, and `changelog` stores",
      "Spec names are normalised. Spec names are normalised.",
    ].join("\n");
    const out = introduceSpekStyle("spektacular", "readme.md", src);
    expect(out).toContain("Spek turns it into a plan.");
    expect(out).toContain("the central `spec`, `plan`, and `changelog` stores");
    // replaceAll: every occurrence is rewritten, not just the first.
    expect(out).toBe(
      "Spek turns it into a plan.\nthe central `spec`, `plan`, and `changelog` stores\nSpek names are normalised. Spek names are normalised."
    );
  });

  it("rewrites the getting-started tutorial with its own table", () => {
    const out = introduceSpekStyle(
      "spektacular",
      "getting-started.md",
      "In this tutorial you will see how Spektacular's agent works."
    );
    expect(out).toBe("In this tutorial you will see how Spek's agent works.");
  });
});
