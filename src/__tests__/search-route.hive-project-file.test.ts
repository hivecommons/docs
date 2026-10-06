import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test for the /api/search route silently excluding hive-project
 * pages (hivecommons/docs#155, #162): buildPageMap() defaults to the hive
 * project, whose routeMap values are paths relative to docs/content/hive/
 * (e.g. 'release-channels.md'), not the shared docs/content/ root. The
 * previous readLocalFile() only ever checked docs/content/, so
 * fs.existsSync() failed for every hive-specific page and none of that
 * content — including the release-channels page — ever reached the search
 * index, even though the page rendered fine and was linked from the sidebar.
 */

const { mockRouteMap, mockFiles } = vi.hoisted(() => {
  const mockRouteMap: Record<string, string> = {
    // Lives at docs/content/hive/release-channels.md, not docs/content/.
    "operations/release-channels": "release-channels.md",
    // A general-section page that does live directly under docs/content/.
    "community/what-is-hive-commons": "community/what-is-hive-commons.md",
  };

  const mockFiles: Record<string, string> = {
    // Keyed by path relative to docs/content/hive/.
    "hive/release-channels.md":
      "# Release Channels\n\nHive publishes three release channels: stable, candidate, edge.",
    // Keyed by path relative to docs/content/.
    "community/what-is-hive-commons.md":
      "# What is Hive Commons?\n\nAn umbrella community.",
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

describe("GET /api/search — hive project file fallback", () => {
  it("finds content from a hive-project-only page and links it under /docs/hive/", async () => {
    const req = new MockNextRequest("channel");
    const res = await GET(req);
    const hit = res.body.results.find(
      (r: any) => r.title === "Release Channels"
    );
    expect(hit).toBeDefined();
    expect(hit.url).toBe("/docs/hive/operations/release-channels");
  });

  it("still finds a shared general-section page without the /hive/ segment", async () => {
    const req = new MockNextRequest("umbrella");
    const res = await GET(req);
    const hit = res.body.results.find(
      (r: any) => r.title === "What is Hive Commons?"
    );
    expect(hit).toBeDefined();
    expect(hit.url).toBe("/docs/community/what-is-hive-commons");
  });
});
