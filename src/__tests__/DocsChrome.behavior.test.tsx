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

let pathname = "/docs/hive/overview/introduction";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("../components/docs/VersionSelector", () => ({
  VersionSelector: () => <div data-testid="version-selector">Version</div>,
}));

import DocsNavbar from "../components/docs/DocsNavbar";
import { DocsProvider } from "../components/docs/DocsProvider";
import { DocsSidebar } from "../components/docs/DocsSidebar";

function renderWithProvider(ui: React.ReactElement) {
  return render(<DocsProvider>{ui}</DocsProvider>);
}

beforeEach(() => {
  pathname = "/docs/hive/overview/introduction";
  Element.prototype.scrollIntoView = vi.fn();
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/search")) {
      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Install Hive",
              url: "/docs/hive/install",
              category: "Docs",
              snippet: "Install the project",
              highlightedSnippet: "<mark>Install</mark> the project",
              matchType: "title",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ value: "42" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocsNavbar", () => {
  it("fetches GitHub badge stats and renders search results from the API", async () => {
    render(<DocsNavbar />);

    expect(await screen.findByText("Hive Commons")).toBeTruthy();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.click(screen.getAllByLabelText("Search documentation")[0]);
    const input = await screen.findByPlaceholderText("Search documentation...");
    fireEvent.change(input, { target: { value: "install" } });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    expect(await screen.findByText("Install Hive")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Install Hive/ }).getAttribute("href")
    ).toBe("/docs/hive/install");
  });

  it("closes the mobile menu and command palette with Escape", async () => {
    render(<DocsNavbar />);
    fireEvent.click(screen.getByLabelText("Toggle menu"));
    expect(
      screen
        .getByLabelText("Toggle menu")
        .querySelector("path")
        ?.getAttribute("d")
    ).toContain("M6 18");

    fireEvent.click(screen.getAllByLabelText("Search documentation")[0]);
    expect(
      await screen.findByPlaceholderText("Search documentation...")
    ).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Search documentation...")).toBeNull();
  });
});

describe("DocsSidebar", () => {
  const pageMap = [
    { name: "Overview", route: "/docs/hive/overview/introduction" },
    {
      name: "Guides",
      children: [
        { name: "Install", route: "/docs/hive/guides/install" },
        { name: "Meta", kind: "Meta" },
      ],
    },
    {
      name: "Community",
      children: [{ name: "Meetings", route: "/docs/community/meetings" }],
    },
  ];

  it("renders project navigation, general sections, and active links", () => {
    renderWithProvider(<DocsSidebar pageMap={pageMap} projectId="hive" />);

    expect(screen.getByRole("button", { name: /Hive/ })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "hotshot" }).getAttribute("href")
    ).toBe("/docs/hotshot/overview/introduction");
    expect(
      screen.getAllByRole("link", { name: "Overview" })[0].getAttribute("href")
    ).toBe("/docs/hive/overview/introduction");
    expect(screen.getByText("Community")).toBeTruthy();
  });

  it("toggles nested sections and recalculates offsets on layout events", async () => {
    document.body.innerHTML = '<div class="nextra-nav-container"></div>';
    const nav = document.querySelector(".nextra-nav-container") as HTMLElement;
    vi.spyOn(nav, "getBoundingClientRect").mockReturnValue({
      bottom: 72,
    } as DOMRect);

    renderWithProvider(<DocsSidebar pageMap={pageMap} projectId="hive" />);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });
    fireEvent.resize(window);

    const guidesRow = screen.getByText("Guides").closest("div");
    const guidesButton = guidesRow?.querySelector("button");
    expect(guidesButton).toBeTruthy();
    fireEvent.click(guidesButton!);
    expect(
      screen.getByRole("link", { name: "Install" }).getAttribute("href")
    ).toBe("/docs/hive/guides/install");
    fireEvent.click(guidesButton!);
    expect(guidesButton!.getAttribute("aria-label")).toBe("Expand section");
  });
});
