/**
 * Covers the last arm of getPageContent in src/app/docs/[...slug]/page.tsx:
 * the slug is a nav-generated route (present in buildPageMap's routeMap) but
 * the mapped file exists in neither the project content directory nor the
 * shared docs/content root. The lookup must fall through to `return null`,
 * which DocPage turns into notFound(), rather than throwing or rendering an
 * empty page.
 *
 * No committed nav entry points at a missing file (the sync step would fail
 * the build), so the route is injected by wrapping buildPageMap.
 */
import { describe, expect, it, vi } from "vitest";

const NOT_FOUND = new Error("NEXT_NOT_FOUND (test sentinel)");
vi.mock("next/navigation", async importOriginal => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    usePathname: () => "/docs/hive/ghost-route",
    notFound: () => {
      throw NOT_FOUND;
    },
  };
});

const GHOST_ROUTE = "ghost-route";
const GHOST_FILE = "ghost/not-on-disk.md";

const { buildPageMapSpy } = vi.hoisted(() => ({ buildPageMapSpy: vi.fn() }));
vi.mock("../app/docs/page-map", async importOriginal => {
  const actual = await importOriginal<typeof import("../app/docs/page-map")>();
  buildPageMapSpy.mockImplementation(
    (projectId?: Parameters<typeof actual.buildPageMap>[0]) => {
      const real = actual.buildPageMap(projectId);
      return {
        ...real,
        routeMap: { ...real.routeMap, [GHOST_ROUTE]: GHOST_FILE },
      };
    }
  );
  return { ...actual, buildPageMap: buildPageMapSpy };
});

const { compileMdx } = vi.hoisted(() => ({
  compileMdx: vi.fn(() => {
    throw new Error(
      "compileMdx must not be called when no source file resolves"
    );
  }),
}));
vi.mock("nextra/compile", () => ({ compileMdx }));

import fs from "fs";
import path from "path";
import { docsContentPath, getContentPath } from "../app/docs/page-map";
import DocPage from "../app/docs/[...slug]/page";

describe("getPageContent — routeMap hit whose file is missing on disk", () => {
  it("404s instead of rendering when the mapped file is absent from both content roots", async () => {
    expect(fs.existsSync(path.join(getContentPath("hive"), GHOST_FILE))).toBe(
      false
    );
    expect(fs.existsSync(path.join(docsContentPath, GHOST_FILE))).toBe(false);

    await expect(
      DocPage({ params: Promise.resolve({ slug: ["hive", GHOST_ROUTE] }) })
    ).rejects.toBe(NOT_FOUND);

    // The routeMap was consulted for this project and the miss never reached
    // the MDX compiler.
    expect(buildPageMapSpy).toHaveBeenCalledWith("hive");
    expect(compileMdx).not.toHaveBeenCalled();
  });
});
