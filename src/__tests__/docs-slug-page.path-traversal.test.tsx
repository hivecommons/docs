/**
 * readLocalFile has two traversal guards: it rejects any path containing
 * `..` before touching the filesystem, and it re-checks that the joined path
 * still starts with the content root. The existing DocPage suites only
 * exercise slugs that resolve inside docs/content/, so neither rejecting
 * branch was ever executed.
 *
 * Each case below targets a file that really exists above the content root
 * (this repository's own README.md / package.json), so if both guards are
 * removed the page serves the README and the assertion fails on content,
 * not by accident.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const NOT_FOUND = new Error("NEXT_NOT_FOUND (test sentinel)");
vi.mock("next/navigation", async importOriginal => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    usePathname: () => "/docs",
    notFound: () => {
      throw NOT_FOUND;
    },
  };
});

// Any traversal that slips through would reach the MDX compiler; make it fatal.
const { compileMdx } = vi.hoisted(() => ({
  compileMdx: vi.fn(() => {
    throw new Error("compileMdx must not be called for a traversal slug");
  }),
}));
vi.mock("nextra/compile", () => ({ compileMdx }));

import DocPage from "../app/docs/[...slug]/page";

const contentRoot = path.join(process.cwd(), "docs", "content");

function render(slug: string[]) {
  return DocPage({ params: Promise.resolve({ slug }) });
}

describe("DocPage — `..` slug segments never escape docs/content", () => {
  it("the traversal targets exist on disk, so a missing guard would serve them", () => {
    expect(fs.existsSync(path.join(contentRoot, "..", "..", "README.md"))).toBe(
      true
    );
    expect(
      fs.existsSync(path.join(contentRoot, "..", "..", "package.json"))
    ).toBe(true);
  });

  it("404s a general-section slug that climbs to the repository README", async () => {
    await expect(render(["..", "..", "README"])).rejects.toBe(NOT_FOUND);
    expect(compileMdx).not.toHaveBeenCalled();
  });

  it("404s a project-prefixed slug that climbs out of the project content dir", async () => {
    // projectId=pluk → docs/content/pluk; three `..` reach the repo root.
    await expect(render(["pluk", "..", "..", "..", "README"])).rejects.toBe(
      NOT_FOUND
    );
    expect(compileMdx).not.toHaveBeenCalled();
  });

  it("404s when `..` is embedded mid-path rather than leading", async () => {
    await expect(
      render(["community", "..", "..", "..", "package"])
    ).rejects.toBe(NOT_FOUND);
    expect(compileMdx).not.toHaveBeenCalled();
  });

  it("404s a `..` carried inside a single segment", async () => {
    await expect(render(["..%2F..%2FREADME"])).rejects.toBe(NOT_FOUND);
    await expect(render(["a..b"])).rejects.toBe(NOT_FOUND);
    expect(compileMdx).not.toHaveBeenCalled();
  });
});
