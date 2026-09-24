import { describe, it, expect } from "vitest";
import { PROJECTS, rewriteLinks, scrubLegacyBranding, syncedHeader, type ProjectSync } from "./sync-sibling-docs";

const SIBLING_PROJECTS = ["hotshot", "pluk", "rationguard", "promptargs", "dibs", "spektacular"];

function project(id: string): ProjectSync {
  const p = PROJECTS.find((x) => x.project === id);
  if (!p) throw new Error(`no project ${id}`);
  return p;
}

describe("PROJECTS", () => {
  it("lists every sibling project exactly once", () => {
    expect(PROJECTS.map((p) => p.project)).toEqual(SIBLING_PROJECTS);
  });

  it("requires a readme for every project", () => {
    for (const p of PROJECTS) {
      expect(p.files.some((f) => f.target === "readme.md" && f.required)).toBe(true);
    }
  });

  it("pulls Spektacular from both the repo and the website", () => {
    const spek = project("spektacular");
    const targets = spek.files.map((f) => f.target);
    expect(targets).toEqual(["readme.md", "knowledge-base.md", "getting-started.md", "unknown-criteria.md"]);
    const website = spek.files.filter((f) => f.repo);
    expect(website.map((f) => f.repo!.repo)).toEqual(["spektacular-website", "spektacular-website"]);
    for (const f of website) {
      expect(f.format).toBe("mdx");
      expect(f.siteBase).toBe("https://spektacular.dev");
      expect(f.assetsRoot).toBe("public");
    }
    expect(spek.canonicalSite).toBe("https://spektacular.dev");
  });
});

describe("syncedHeader", () => {
  it("names the per-file repo and links the canonical page for website-sourced pages", () => {
    const spek = project("spektacular");
    const tutorial = spek.files.find((f) => f.target === "getting-started.md")!;
    const header = syncedHeader(spek, tutorial);
    expect(header).toContain("Synced from spektacular-website.");
    expect(header).toContain("spektacular-website/blob/main/src/content/tutorials/getting-started.mdx");
    expect(header).toContain("[spektacular.dev](https://spektacular.dev/tutorials/getting-started/)");
    expect(header).toContain("canonical copy");
  });

  it("adds the canonical-site note to the overview page", () => {
    const spek = project("spektacular");
    const readme = spek.files.find((f) => f.target === "readme.md")!;
    expect(syncedHeader(spek, readme)).toContain("[spektacular.dev](https://spektacular.dev)");
  });

  it("omits the note for projects without a canonical site", () => {
    const pluk = project("pluk");
    expect(syncedHeader(pluk, pluk.files[0])).not.toContain("Also published");
  });
});

describe("rewriteLinks", () => {
  const spek = project("spektacular");

  it("routes a link to a synced page to its docs route", () => {
    expect(rewriteLinks("[kb](docs/knowledge-base.md#tags)", spek)).toBe(
      "[kb](/docs/spektacular/knowledge-base#tags)"
    );
  });

  it("sends other relative links to the file's own repo", () => {
    const tutorial = spek.files.find((f) => f.target === "getting-started.md")!;
    expect(rewriteLinks("[x](../foo.md)", spek, tutorial)).toBe(
      "[x](https://github.com/hivecommons/spektacular-website/blob/main/../foo.md)"
    );
    expect(rewriteLinks("[lic](LICENSE)", spek)).toBe(
      "[lic](https://github.com/hivecommons/spektacular/blob/main/LICENSE)"
    );
  });

  it("leaves absolute and anchor links alone", () => {
    const src = "[a](https://x.y) [b](#c) [d](/docs/hive)";
    expect(rewriteLinks(src, spek)).toBe(src);
  });
});

describe("scrubLegacyBranding", () => {
  it("rewrites transferred jumppad-labs repo sub-paths but not the Go module path", () => {
    expect(scrubLegacyBranding("https://github.com/jumppad-labs/spektacular/releases")).toBe(
      "https://github.com/hivecommons/spektacular/releases"
    );
    expect(scrubLegacyBranding("go install github.com/jumppad-labs/spektacular@latest")).toBe(
      "go install github.com/jumppad-labs/spektacular@latest"
    );
    expect(scrubLegacyBranding("https://github.com/jumppad-labs/tutorial-spektacular-how-to")).toBe(
      "https://github.com/jumppad-labs/tutorial-spektacular-how-to"
    );
  });
});
