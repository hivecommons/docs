// @vitest-environment jsdom
//
// Covers src/components/NotFoundUI.tsx (previously 0%):
//  - Hive-docs pathnames get Hive quick links, the Hive-specific message,
//    and the "Hive docs links" heading; other paths get the general set
//  - the requested path is echoed back, and omitted when pathname is null
//  - external quick links open in a new tab with rel="noopener noreferrer"
//  - search: empty/whitespace query is a no-op; a real query hits
//    /api/search, shows the loading hint, and renders at most 5 results
//  - failed responses show the "temporarily unavailable" hint; an ok
//    response with no results shows "No matching docs found."
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const usePathnameMock = vi.fn<() => string | null>();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import NotFoundUI from "@/components/NotFoundUI";

type SearchResult = { title: string; url: string; category: string; snippet: string };

function makeResults(count: number): SearchResult[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Result ${i + 1}`,
    url: `/docs/result-${i + 1}`,
    category: `Category ${i + 1}`,
    snippet: `Snippet ${i + 1}`,
  }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  usePathnameMock.mockReturnValue("/docs/missing-page");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("quick links and messaging", () => {
  it("shows Hive-specific links and message under /docs/hive/", () => {
    usePathnameMock.mockReturnValue("/docs/hive/some/moved/page");
    render(<NotFoundUI />);

    expect(screen.getByRole("heading", { name: "Hive docs links" })).toBeTruthy();
    expect(screen.getByText(/reorganized the Hive docs/)).toBeTruthy();
    // primary quick links render both as action buttons and in the sidebar list
    const intros = screen.getAllByRole("link", { name: /Hive intro/ });
    expect(intros).toHaveLength(2);
    expect(intros[0].getAttribute("href")).toBe("/docs/hive/readme");
    expect(screen.getAllByRole("link", { name: /Documentation map/ }).length).toBeGreaterThan(0);
  });

  it("treats the bare /docs/hive path as Hive docs", () => {
    usePathnameMock.mockReturnValue("/docs/hive");
    render(<NotFoundUI />);

    expect(screen.getByRole("heading", { name: "Hive docs links" })).toBeTruthy();
  });

  it("shows the general links and message elsewhere", () => {
    usePathnameMock.mockReturnValue("/docs/hotshot/nope");
    render(<NotFoundUI />);

    expect(screen.getByRole("heading", { name: "Helpful links" })).toBeTruthy();
    expect(screen.getByText(/reorganized Hive Commons documentation/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /What is Hive Commons\?/ }).length).toBeGreaterThan(0);
  });

  it("marks external quick links to open safely in a new tab", () => {
    usePathnameMock.mockReturnValue("/docs/anything");
    render(<NotFoundUI />);

    const github = screen.getByRole("link", { name: /GitHub/ });
    expect(github.getAttribute("href")).toBe("https://github.com/hivecommons");
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("echoes the requested path", () => {
    usePathnameMock.mockReturnValue("/docs/some/lost/page");
    render(<NotFoundUI />);

    expect(screen.getByText("Requested path")).toBeTruthy();
    expect(screen.getByText("/docs/some/lost/page")).toBeTruthy();
  });

  it("omits the path box when pathname is unavailable", () => {
    usePathnameMock.mockReturnValue(null);
    render(<NotFoundUI />);

    expect(screen.queryByText("Requested path")).toBeNull();
    // null pathname is not Hive docs, so the general set renders
    expect(screen.getByRole("heading", { name: "Helpful links" })).toBeTruthy();
  });
});

describe("search", () => {
  function submitSearch(value: string) {
    const input = screen.getByLabelText("Search documentation");
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
  }

  it("ignores empty and whitespace-only queries", () => {
    render(<NotFoundUI />);

    submitSearch("   ");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Search Hive, Spektacular/)).toBeTruthy();
  });

  it("queries /api/search with the encoded term and caps results at 5", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ results: makeResults(7) }),
    });
    render(<NotFoundUI />);

    submitSearch("multi cluster");
    expect(screen.getByText("Searching…")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Result 1")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=multi%20cluster");
    expect(screen.getByText("Result 5")).toBeTruthy();
    expect(screen.queryByText("Result 6")).toBeNull();
    expect(screen.getByText("Category 1")).toBeTruthy();
    expect(screen.getByText("Snippet 1")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Result 1/ }).getAttribute("href"),
    ).toBe("/docs/result-1");
  });

  it("shows the empty-results hint when the API returns nothing", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<NotFoundUI />);

    submitSearch("nothing matches this");
    await waitFor(() => expect(screen.getByText("No matching docs found.")).toBeTruthy());
  });

  it("shows the unavailable hint on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<NotFoundUI />);

    submitSearch("boom");
    await waitFor(() =>
      expect(screen.getByText("Search is temporarily unavailable.")).toBeTruthy(),
    );
  });

  it("shows the unavailable hint when fetch rejects, and clears stale results", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: makeResults(1) }),
    });
    render(<NotFoundUI />);

    submitSearch("first");
    await waitFor(() => expect(screen.getByText("Result 1")).toBeTruthy());

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    submitSearch("second");
    await waitFor(() =>
      expect(screen.getByText("Search is temporarily unavailable.")).toBeTruthy(),
    );
    expect(screen.queryByText("Result 1")).toBeNull();
  });
});
