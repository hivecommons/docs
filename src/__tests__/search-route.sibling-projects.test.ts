import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/search must index sibling projects (pluk, dibs, ...) under
 * /docs/<project>/..., not just hive + general sections
 * (hivecommons/docs#262).
 */

const { mockFiles } = vi.hoisted(() => {
  const mockFiles: Record<string, string> = {
    "pluk/roadmap.md": "# Pluk Roadmap\n\nWhat comes next for pluk.",
    "community/what-is-hive-commons.md": "# What is Hive Commons?\n\nUmbrella.",
  };
  return { mockFiles };
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
  buildPageMap: (projectId: string = "hive") => ({
    routeMap:
      projectId === "pluk"
        ? {
            roadmap: "roadmap.md",
            "community/what-is-hive-commons":
              "community/what-is-hive-commons.md",
          }
        : {
            "community/what-is-hive-commons":
              "community/what-is-hive-commons.md",
          },
  }),
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

describe("GET /api/search — sibling projects", () => {
  it("finds a sibling-project page and links it under /docs/<project>/", async () => {
    const res = await GET(new MockNextRequest("Pluk Roadmap"));
    const hits = res.body.results.filter(
      (r: { title: string }) => r.title === "Pluk Roadmap"
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].url).toBe("/docs/pluk/roadmap");
  });

  it("lists shared general-section pages once", async () => {
    const res = await GET(new MockNextRequest("umbrella"));
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].url).toBe(
      "/docs/community/what-is-hive-commons"
    );
  });
});
