// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

// DocsChrome.behavior.test.tsx opens the mobile menu under the light theme and
// DocsNavbar.search-keyboard.test.tsx opens the GitHub dropdown and the
// no-results state under the dark theme. Each surface picks its classes from
// an `isDark ? … : …` ternary, so the other half of every ternary was never
// rendered. This file flips the theme per test to cover both halves of each
// surface and pins the one behavioural difference between them.

const themeState = vi.hoisted(() => ({ resolvedTheme: "dark" }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href?: string;
    children?: ReactNode;
  }) => (
    <a
      href={href}
      {...Object.fromEntries(
        Object.entries(rest).filter(([key]) => key !== "prefetch")
      )}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, ...rest }: { alt?: string; src?: string }) =>
    React.createElement("img", { alt, src, ...rest }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/docs/hive/overview/introduction",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme }),
}));

vi.mock("../components/docs/VersionSelector", () => ({
  VersionSelector: ({ isMobile }: { isMobile?: boolean }) => (
    <div
      data-testid={isMobile ? "version-selector-mobile" : "version-selector"}
    >
      Version
    </div>
  ),
}));

import DocsNavbar from "../components/docs/DocsNavbar";

const PLACEHOLDER = "Search documentation...";
const DEBOUNCE_MS = 300;

let searchResults: Array<{ title: string; url: string }> = [];

async function openPaletteAndSearch(query: string) {
  fireEvent.click(screen.getAllByLabelText("Search documentation")[0]);
  const input = await screen.findByPlaceholderText(PLACEHOLDER);
  fireEvent.change(input, { target: { value: query } });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 50));
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Render and wait for the GitHub stats fetch so no state update lands after the test. */
async function renderNavbar() {
  render(<DocsNavbar />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  await act(async () => {});
}

function githubTrigger(): HTMLElement {
  const trigger = document.querySelector(
    '[aria-haspopup="true"][aria-label="GitHub"]'
  );
  expect(trigger).not.toBeNull();
  return trigger as HTMLElement;
}

async function openGithubDropdown(): Promise<HTMLElement> {
  const trigger = githubTrigger();
  fireEvent.mouseEnter(trigger.parentElement!);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  // The panel is the sibling rendered after the trigger inside the hover root.
  return trigger.nextElementSibling as HTMLElement;
}

function mobileMenuLink(name: string): HTMLAnchorElement {
  // The mobile menu duplicates desktop links; it is the `xl:hidden` panel.
  const panel = document.querySelector("div.xl\\:hidden.border-t");
  expect(panel).not.toBeNull();
  const link = Array.from(panel!.querySelectorAll("a")).find(
    a => a.textContent?.trim() === name
  );
  expect(link, `mobile menu link "${name}"`).toBeTruthy();
  return link as HTMLAnchorElement;
}

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/search")) {
      return jsonResponse({
        results: searchResults.map(r => ({
          ...r,
          category: "Docs",
          snippet: r.title,
          highlightedSnippet: r.title,
          matchType: "title",
        })),
      });
    }
    return jsonResponse({ value: "42" });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  themeState.resolvedTheme = "dark";
  searchResults = [];
});

describe("DocsNavbar GitHub dropdown across themes", () => {
  it("renders the light palette for the panel and its links", async () => {
    themeState.resolvedTheme = "light";
    await renderNavbar();

    const panel = await openGithubDropdown();
    expect(panel.className).toContain("bg-bg border-line");
    expect(panel.className).not.toContain("bg-bg-2");

    const links = Array.from(panel.querySelectorAll("a"));
    expect(links.map(a => a.getAttribute("href"))).toEqual([
      "https://github.com/hivecommons/hive",
      "https://github.com/hivecommons/docs",
      "https://github.com/hivecommons/hivecommons.github.io",
      "https://github.com/hivecommons",
    ]);
    for (const a of links) {
      expect(a.className).toContain("hover:bg-bg-2");
      expect(a.className).not.toContain("hover:bg-bg-3");
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    // The star badge on "Hive source" comes from the GitHub stats fetch.
    expect(links[0].textContent).toContain("42");
  });

  it("renders the dark palette for the panel and its links", async () => {
    await renderNavbar();

    const panel = await openGithubDropdown();
    expect(panel.className).toContain("bg-bg-2 border-line");
    for (const a of panel.querySelectorAll("a")) {
      expect(a.className).toContain("hover:bg-bg-3");
      expect(a.className).not.toContain("hover:bg-bg-2");
    }
  });

  it("stops the logo link's click from bubbling past the trigger", async () => {
    themeState.resolvedTheme = "light";
    await renderNavbar();
    const trigger = githubTrigger();
    const logoLink = trigger.querySelector("a")!;
    expect(logoLink.getAttribute("href")).toBe(
      "https://github.com/hivecommons/hive"
    );

    const outerClick = vi.fn();
    document.addEventListener("click", outerClick);
    try {
      fireEvent.click(logoLink);
      expect(outerClick).not.toHaveBeenCalled();
      // The hover dropdown is unaffected by the click.
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      fireEvent.mouseEnter(trigger.parentElement!);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(logoLink);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(outerClick).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("click", outerClick);
    }
  });
});

describe("DocsNavbar palette results in the light theme", () => {
  it("highlights the selected row and leaves the rest hover-only", async () => {
    themeState.resolvedTheme = "light";
    searchResults = [
      { title: "First Result", url: "/docs/hive/first" },
      { title: "Second Result", url: "/docs/hive/second" },
    ];
    await renderNavbar();

    await openPaletteAndSearch("result");
    const first = await screen.findByRole("link", { name: /First Result/ });
    const second = screen.getByRole("link", { name: /Second Result/ });
    expect(first.className).toContain("bg-bg-2 border-honey");
    expect(second.className).toContain("hover:bg-bg-2 border-transparent");
    expect(second.className).not.toContain("bg-bg-3");

    fireEvent.mouseEnter(second);
    expect(second.className).toContain("bg-bg-2 border-honey");
    expect(first.className).toContain("hover:bg-bg-2 border-transparent");
  });
});

describe("DocsNavbar palette no-results state in the light theme", () => {
  it("shows the empty-state copy after a search with zero hits", async () => {
    themeState.resolvedTheme = "light";
    await renderNavbar();

    await openPaletteAndSearch("nothing");

    const empty = await screen.findByText(/No results found for "nothing"/);
    expect(empty.className).toContain("text-ink-2");
    expect(
      screen.getByText("Try different keywords or check spelling").className
    ).toContain("text-ink-3");
  });
});

describe("DocsNavbar mobile menu across themes", () => {
  const LINKS: Array<[string, string]> = [
    ["Live Demo", "https://hive.hivecommons.dev"],
    ["Hive source", "https://github.com/hivecommons/hive"],
    [
      "Good first issues",
      "https://github.com/hivecommons/hive/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22",
    ],
    ["Open issues", "https://github.com/hivecommons/hive/issues"],
    ["Security policy", "https://github.com/hivecommons/hive/security/policy"],
    ["What is Hive Commons?", "/docs/community/what-is-hive-commons"],
    ["Join Hive Commons", "/docs/community/join-hive-commons"],
    ["Discord", "https://hivecommons.dev/discord/"],
    ["Community meetings", "/docs/community/meetings"],
  ];

  it("uses the dark hover palette and dark section headings", async () => {
    await renderNavbar();
    fireEvent.click(screen.getByLabelText("Toggle menu"));

    for (const [name, href] of LINKS) {
      const link = mobileMenuLink(name);
      expect(link.getAttribute("href")).toBe(href);
      expect(link.className).toContain("hover:bg-bg-3");
      expect(link.className).not.toContain("hover:bg-bg-2");
    }
    for (const heading of ["Contribute", "Community"]) {
      const headings = screen
        .getAllByText(heading)
        .filter(el => el.className.includes("uppercase"));
      expect(headings).not.toHaveLength(0);
      for (const el of headings) {
        expect(el.className).toContain("text-ink-2");
        expect(el.className).not.toContain("text-ink-3");
      }
    }
    expect(screen.getByTestId("version-selector-mobile")).toBeTruthy();
  });

  it("uses the light hover palette and light section headings", async () => {
    themeState.resolvedTheme = "light";
    await renderNavbar();
    fireEvent.click(screen.getByLabelText("Toggle menu"));

    for (const [name] of LINKS) {
      const link = mobileMenuLink(name);
      expect(link.className).toContain("hover:bg-bg-2");
      expect(link.className).not.toContain("hover:bg-bg-3");
    }
    for (const heading of ["Contribute", "Community"]) {
      const headings = screen
        .getAllByText(heading)
        .filter(el => el.className.includes("uppercase"));
      expect(headings).not.toHaveLength(0);
      for (const el of headings) {
        expect(el.className).toContain("text-ink-3");
      }
    }
  });

  it("toggles closed again from the same button", async () => {
    await renderNavbar();
    const toggle = screen.getByLabelText("Toggle menu");
    fireEvent.click(toggle);
    expect(document.querySelector("div.xl\\:hidden.border-t")).not.toBeNull();
    fireEvent.click(toggle);
    expect(document.querySelector("div.xl\\:hidden.border-t")).toBeNull();
  });
});
