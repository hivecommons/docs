/**
 * Coverage for two DocPage arms that docs-slug-page.params-metadata.test.tsx
 * does not reach:
 *
 * - The `community/meetings.md` special case: the route renders the
 *   interactive <MeetingsPage /> inside the DocsLayout wrapper instead of
 *   compiling the markdown stub, with a fixed "Community meetings" title.
 * - readLocalFile's shared-content fallback: a general-section file that is
 *   absent from a project's content directory is read from docs/content/
 *   when the slug is project-prefixed (/docs/<project>/community/...).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";

const NOT_FOUND = new Error("NEXT_NOT_FOUND (test sentinel)");
vi.mock("next/navigation", async importOriginal => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    usePathname: () => "/docs/community/meetings",
    notFound: () => {
      throw NOT_FOUND;
    },
  };
});

vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: { href?: unknown; children?: ReactNode } & Record<string, unknown>) =>
      h(
        "a",
        { ...rest, href: typeof href === "string" ? href : undefined },
        children
      ),
  };
});

// The meetings arm must never reach the MDX compiler: make it fatal if it does.
const { compileMdx } = vi.hoisted(() => ({
  compileMdx: vi.fn(() => {
    throw new Error("compileMdx must not be called for community/meetings.md");
  }),
}));
vi.mock("nextra/compile", () => ({ compileMdx }));

import { DocsProvider } from "../components/docs/DocsProvider";
import DocPage from "../app/docs/[...slug]/page";

const ANCHOR = new Date("2026-10-06T12:00:00Z");

async function renderDocsRoute(slug: string[]): Promise<string> {
  const page = await DocPage({ params: Promise.resolve({ slug }) });
  return renderToStaticMarkup(createElement(DocsProvider, null, page));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ANCHOR);
});

afterEach(() => {
  vi.useRealTimers();
  compileMdx.mockClear();
});

describe("DocPage — community/meetings.md special arm", () => {
  it("renders <MeetingsPage /> instead of compiling the markdown stub", async () => {
    const html = await renderDocsRoute(["community", "meetings"]);

    expect(compileMdx).not.toHaveBeenCalled();
    // The interactive page's hero/countdown, not a <pre> fallback or MDX body.
    expect(html).toContain("hc-meetings-page");
    expect(html).not.toContain("<pre>");
    // The wrapper receives the fixed title (no MDX frontmatter to read it
    // from); it surfaces as the "Open Issue" link's prefilled title.
    expect(html).toContain("title=Docs%3A%20Community%20meetings");
  });

  it("is keyed on the resolved filePath, so the markdown stub itself is never shown", async () => {
    const stub = fs.readFileSync(
      path.join(process.cwd(), "docs/content/community/meetings.md"),
      "utf-8"
    );
    const firstBodyLine = stub
      .split("\n")
      .map(l => l.trim())
      .find(l => l.length > 0 && !l.startsWith("#") && !l.startsWith("---"));

    const html = await renderDocsRoute(["community", "meetings"]);
    if (firstBodyLine) {
      expect(html).not.toContain(firstBodyLine);
    }
  });
});

describe("readLocalFile — shared docs/content fallback for project-prefixed slugs", () => {
  it("serves a general-section file under /docs/<project>/ from docs/content/", async () => {
    // pluk's content dir has no community/ folder; the file lives only in
    // the shared root, so this exercises the `contentPath !== docsContentPath`
    // fallback (and resolves to the meetings arm, which keeps the test fast).
    expect(
      fs.existsSync(path.join(process.cwd(), "docs/content/pluk/community"))
    ).toBe(false);

    const html = await renderDocsRoute(["pluk", "community", "meetings"]);
    expect(compileMdx).not.toHaveBeenCalled();
    expect(html).toContain("hc-meetings-page");
  });

  it("still 404s when the file exists in neither the project nor the shared root", async () => {
    await expect(
      DocPage({
        params: Promise.resolve({
          slug: ["pluk", "community", "no-such-page"],
        }),
      })
    ).rejects.toBe(NOT_FOUND);
  });
});
