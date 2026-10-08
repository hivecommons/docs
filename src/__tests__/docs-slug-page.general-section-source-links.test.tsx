import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", async importOriginal => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, usePathname: () => "/docs/community/meetings" };
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

vi.mock("nextra/compile", () => ({
  compileMdx: vi.fn(() => {
    throw new Error("compileMdx must not be called for community/meetings.md");
  }),
}));

import { DocsProvider } from "../components/docs/DocsProvider";
import DocPage from "../app/docs/[...slug]/page";

const EDIT =
  "https://github.com/hivecommons/docs/edit/main/docs/content/community/meetings.md?fork=true";
const BLOB =
  "https://github.com/hivecommons/docs/blob/main/docs/content/community/meetings.md";

async function renderDocsRoute(slug: string[]): Promise<string> {
  const page = await DocPage({ params: Promise.resolve({ slug }) });
  return renderToStaticMarkup(createElement(DocsProvider, null, page));
}

describe("general-section pages — source action links", () => {
  it.each([[["community", "meetings"]], [["pluk", "community", "meetings"]]])(
    "%j targets the docs repository",
    async slug => {
      const html = await renderDocsRoute(slug);

      expect(html).toContain(`href="${EDIT}"`);
      expect(html).toContain(`href="${BLOB}"`);
      expect(html).toContain(encodeURIComponent(`Source file:\n${BLOB}`));
      expect(html).not.toContain("hivecommons/hive/edit");
      expect(html).not.toContain("hivecommons/pluk/edit");
    }
  );
});
