import { describe, it, expect, vi, beforeEach } from "vitest";

/** Synced-from provenance banner must not leak into the search index (hivecommons/docs#705). */

const { mockRouteMap, mockFiles } = vi.hoisted(() => {
  const mockRouteMap: Record<string, string> = {
    "architecture/overview": "architecture.md",
    "pluk/readme": "pluk/readme.md",
    "guides/callout": "guides/callout.md",
  };
  const mockFiles: Record<string, string> = {
    "hive/architecture.md":
      "> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/architecture.md) during the docs build. Edit the canonical source in the Hive repository.\n\n# Architecture Overview\n\nHive runs as a single control plane.",
    // Shape emitted by scripts/sync-sibling-docs.ts when the project has a canonicalSite.
    "pluk/readme.md":
      "> **Synced from pluk.** This page is pulled from [hivecommons/pluk@main](https://github.com/hivecommons/pluk/blob/main/README.md) during the docs build. Edit the canonical source in the pluk repository.\n>\n> Also published at [pluk.dev](https://pluk.dev/), which is the canonical copy of this documentation.\n\n# Pluk Readme\n\nPluk fans out events.",
    // A hand-written leading callout is page text and must stay indexed.
    "guides/callout.md":
      "> **Warning.** Rotating credentials here is irreversible.\n\n# Callout Guide\n\nRead before acting.",
  };
  return { mockRouteMap, mockFiles };
});

vi.mock("fs", () => ({
  default: {
    existsSync: (filePath: string) => {
      const rel = filePath.replace(/.*\/docs\/content\//, "");
      return rel in mockFiles;
    },
    readFileSync: (filePath: string) => {
      const rel = filePath.replace(/.*\/docs\/content\//, "");
      return mockFiles[rel] || "";
    },
  },
}));

vi.mock("../app/docs/page-map", () => ({
  buildPageMap: () => ({ routeMap: mockRouteMap }),
  docsContentPath: "/fake/docs/content",
  basePath: "docs",
}));

vi.mock("@/lib/transformMdx", () => ({
  convertHtmlScriptsToJsxComments: (content: string) => content,
}));

vi.mock("path", async () => {
  const actual = await vi.importActual<typeof import("path")>("path");
  return {
    ...actual,
    default: {
      ...actual,
      join: (...parts: string[]) => parts.join("/").replace(/\/+/g, "/"),
    },
  };
});

class MockNextRequest {
  nextUrl: { searchParams: URLSearchParams };
  constructor(query: string) {
    this.nextUrl = {
      searchParams: new URLSearchParams(query ? `q=${query}` : ""),
    };
  }
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}));

let GET: (request: any) => Promise<any>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../app/api/search/route");
  GET = mod.GET;
});

describe("GET /api/search — synced banner", () => {
  it("starts snippet and content at the first real sentence", async () => {
    const res = await GET(new MockNextRequest("architecture"));
    const hit = res.body.results.find(
      (r: any) => r.title === "Architecture Overview"
    );
    expect(hit).toBeDefined();
    expect(hit.matchType).toBe("title");
    for (const field of [hit.snippet, hit.content]) {
      expect(field).not.toContain("Synced from");
      expect(field.startsWith(">")).toBe(false);
      expect(field.startsWith("Architecture Overview")).toBe(true);
    }
  });

  it("does not match banner-only phrases", async () => {
    const res = await GET(new MockNextRequest("canonical%20source"));
    expect(res.body.results).toHaveLength(0);
  });

  it("also drops the sibling banner's contiguous 'Also published at' quote lines", async () => {
    const res = await GET(new MockNextRequest("pluk"));
    const hit = res.body.results.find((r: any) => r.title === "Pluk Readme");
    expect(hit).toBeDefined();
    for (const field of [hit.snippet, hit.content]) {
      expect(field).not.toContain("Also published at");
      expect(field).not.toContain("canonical copy");
      expect(field.startsWith("Pluk Readme")).toBe(true);
    }
    const leak = await GET(new MockNextRequest("canonical%20copy"));
    expect(leak.body.results).toHaveLength(0);
  });

  it("keeps ordinary leading callouts searchable", async () => {
    const res = await GET(new MockNextRequest("irreversible"));
    const hit = res.body.results.find((r: any) => r.title === "Callout Guide");
    expect(hit).toBeDefined();
    expect(hit.matchType).toBe("content");
    expect(hit.content).toContain("Rotating credentials here is irreversible.");
  });
});
