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

vi.mock("next/navigation", () => ({
  usePathname: () => "/docs/hive/overview/introduction",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("../components/docs/VersionSelector", () => ({
  VersionSelector: () => <div data-testid="version-selector">Version</div>,
}));

import DocsNavbar from "../components/docs/DocsNavbar";
import { DROPDOWN_HIDE_DELAY_MS } from "../components/navbar/useHoverDropdown";

const RESULTS = [
  {
    title: "First Result",
    url: "/docs/hive/first",
    category: "Docs",
    snippet: "first",
    highlightedSnippet: "<mark>first</mark>",
    matchType: "title",
  },
  {
    title: "Second Result",
    url: "/docs/hive/second",
    category: "Docs",
    snippet: "second",
    highlightedSnippet: "<mark>second</mark>",
    matchType: "content",
  },
];

const PLACEHOLDER = "Search documentation...";
const DEBOUNCE_MS = 300;

let searchResponse: () => Response | Promise<Response>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function openPaletteAndSearch(query: string) {
  fireEvent.click(screen.getAllByLabelText("Search documentation")[0]);
  const input = await screen.findByPlaceholderText(PLACEHOLDER);
  fireEvent.change(input, { target: { value: query } });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 50));
  });
  return input;
}

function selectedResultTitle(): string | undefined {
  const selected = Array.from(
    document.querySelectorAll("a.border-honey")
  ) as HTMLAnchorElement[];
  return selected[0]?.textContent?.trim().split("\n")[0];
}

beforeEach(() => {
  searchResponse = () => jsonResponse({ results: RESULTS });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/search")) return searchResponse();
    return jsonResponse({ value: "42" });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("DocsNavbar command palette keyboard shortcuts", () => {
  it("toggles the palette with Ctrl+K and ⌘K and focuses the input", async () => {
    render(<DocsNavbar />);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByPlaceholderText(PLACEHOLDER);
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull()
    );
  });

  it("moves the selection with ArrowDown/ArrowUp, clamping at both ends", async () => {
    render(<DocsNavbar />);
    await openPaletteAndSearch("result");

    expect(await screen.findByText("First Result")).toBeTruthy();
    expect(screen.getByText("Second Result")).toBeTruthy();
    expect(screen.getByText("First Result").closest("a")?.className).toContain(
      "border-honey"
    );

    fireEvent.keyDown(document, { key: "ArrowDown" });
    await waitFor(() =>
      expect(
        screen.getByText("Second Result").closest("a")?.className
      ).toContain("border-honey")
    );

    // Already at the last result: ArrowDown must not move past it.
    fireEvent.keyDown(document, { key: "ArrowDown" });
    await act(async () => {});
    expect(screen.getByText("Second Result").closest("a")?.className).toContain(
      "border-honey"
    );

    fireEvent.keyDown(document, { key: "ArrowUp" });
    await waitFor(() =>
      expect(
        screen.getByText("First Result").closest("a")?.className
      ).toContain("border-honey")
    );

    // Already at the first result: ArrowUp clamps to 0.
    fireEvent.keyDown(document, { key: "ArrowUp" });
    await act(async () => {});
    expect(screen.getByText("First Result").closest("a")?.className).toContain(
      "border-honey"
    );
    expect(selectedResultTitle()).toContain("First Result");
  });

  it("hovering a result selects it, and Enter navigates to the selected URL", async () => {
    const assigned: string[] = [];
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          assigned.push(value);
        },
        get href() {
          return assigned[assigned.length - 1] ?? "http://localhost/";
        },
      },
    });

    try {
      render(<DocsNavbar />);
      await openPaletteAndSearch("result");
      const second = (await screen.findByText("Second Result")).closest("a")!;

      fireEvent.mouseEnter(second);
      await waitFor(() => expect(second.className).toContain("border-honey"));

      fireEvent.keyDown(document, { key: "Enter" });
      await waitFor(() => expect(assigned).toEqual(["/docs/hive/second"]));
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("ignores arrow keys and Enter when there are no results", async () => {
    searchResponse = () => jsonResponse({ results: [] });
    render(<DocsNavbar />);
    await openPaletteAndSearch("nothing");

    expect(
      await screen.findByText(/No results found for "nothing"/)
    ).toBeTruthy();

    const down = fireEvent.keyDown(document, { key: "ArrowDown" });
    const enter = fireEvent.keyDown(document, { key: "Enter" });
    // Not prevented → the handler never reached the navigation branch.
    expect(down).toBe(true);
    expect(enter).toBe(true);
  });
});

describe("DocsNavbar search request lifecycle", () => {
  it("clears results and the spinner without calling the API for a blank query", async () => {
    render(<DocsNavbar />);
    const input = await openPaletteAndSearch("result");
    expect(await screen.findByText("First Result")).toBeTruthy();

    const searchCalls = () =>
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) =>
        String(u).startsWith("/api/search")
      ).length;
    const before = searchCalls();

    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 50));
    });

    expect(screen.queryByText("First Result")).toBeNull();
    expect(screen.queryByText("Searching documentation...")).toBeNull();
    expect(screen.getByText(/Search for any word or phrase/)).toBeTruthy();
    expect(searchCalls()).toBe(before);
  });

  it("debounces rapid typing into a single API call", async () => {
    render(<DocsNavbar />);
    fireEvent.click(screen.getAllByLabelText("Search documentation")[0]);
    const input = await screen.findByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "r" } });
    fireEvent.change(input, { target: { value: "re" } });
    fireEvent.change(input, { target: { value: "res" } });
    expect(screen.getByText("Searching documentation...")).toBeTruthy();

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 50));
    });

    const searchUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      .map(([u]) => String(u))
      .filter(u => u.startsWith("/api/search"));
    expect(searchUrls).toEqual(["/api/search?q=res"]);
  });

  it("logs and empties results when the API responds with an error status", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    searchResponse = () => jsonResponse({ error: "boom" }, 500);

    render(<DocsNavbar />);
    await openPaletteAndSearch("broken");

    expect(
      await screen.findByText(/No results found for "broken"/)
    ).toBeTruthy();
    expect(consoleError).toHaveBeenCalledWith(
      "Search error:",
      expect.any(Error)
    );
    expect(screen.queryByText("Searching documentation...")).toBeNull();
  });

  it("recovers when fetch itself rejects", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    searchResponse = () => Promise.reject(new Error("network down"));

    render(<DocsNavbar />);
    await openPaletteAndSearch("offline");

    expect(
      await screen.findByText(/No results found for "offline"/)
    ).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
  });

  it("treats a payload without a results array as zero results", async () => {
    searchResponse = () => jsonResponse({});
    render(<DocsNavbar />);
    await openPaletteAndSearch("empty");
    expect(
      await screen.findByText(/No results found for "empty"/)
    ).toBeTruthy();
  });
});

describe("DocsNavbar palette open/close affordances", () => {
  it("opens from the mobile search button and closes on backdrop click, resetting state", async () => {
    render(<DocsNavbar />);
    const [, mobileButton] = screen.getAllByLabelText("Search documentation");
    fireEvent.click(mobileButton);
    const input = await screen.findByPlaceholderText(PLACEHOLDER);
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.change(input, { target: { value: "result" } });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 50));
    });
    expect(await screen.findByText("First Result")).toBeTruthy();

    fireEvent.click(document.querySelector(".fixed.inset-0")!);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull()
    );

    // Reopening shows the empty-state prompt, not the stale query/results.
    fireEvent.click(screen.getAllByLabelText("Search documentation")[0]);
    const reopened = await screen.findByPlaceholderText(PLACEHOLDER);
    expect((reopened as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("First Result")).toBeNull();
    expect(screen.getByText(/Search for any word or phrase/)).toBeTruthy();
  });

  it("Escape resets the query and results, not just visibility", async () => {
    render(<DocsNavbar />);
    await openPaletteAndSearch("result");
    expect(await screen.findByText("First Result")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull()
    );

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const reopened = await screen.findByPlaceholderText(PLACEHOLDER);
    expect((reopened as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("First Result")).toBeNull();
  });
});

describe("DocsNavbar hover dropdowns", () => {
  function trigger(name: "contribute" | "community" | "github") {
    const expanded = Array.from(
      document.querySelectorAll('[aria-haspopup="true"]')
    );
    const index = { contribute: 0, community: 1, github: 2 }[name];
    return expanded[index] as HTMLElement;
  }

  it("opens on hover and closes after the shared hide delay", async () => {
    vi.useFakeTimers();
    render(<DocsNavbar />);
    await act(async () => {});

    const contribute = trigger("contribute");
    const wrapper = contribute.parentElement!;
    expect(contribute.getAttribute("aria-expanded")).toBe("false");

    fireEvent.mouseEnter(wrapper);
    expect(contribute.getAttribute("aria-expanded")).toBe("true");
    expect(wrapper.querySelectorAll("a").length).toBeGreaterThan(0);

    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(DROPDOWN_HIDE_DELAY_MS - 1);
    });
    expect(contribute.getAttribute("aria-expanded")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(contribute.getAttribute("aria-expanded")).toBe("false");
  });

  it("re-entering the open menu cancels the pending close", async () => {
    vi.useFakeTimers();
    render(<DocsNavbar />);
    await act(async () => {});

    const community = trigger("community");
    const wrapper = community.parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(community.getAttribute("aria-expanded")).toBe("true");

    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(DROPDOWN_HIDE_DELAY_MS / 2);
    });
    // Pointer moves onto the menu panel itself.
    const panel = wrapper.querySelector(":scope > div:not([aria-haspopup])")!;
    fireEvent.mouseEnter(panel);
    act(() => {
      vi.advanceTimersByTime(DROPDOWN_HIDE_DELAY_MS * 2);
    });
    expect(community.getAttribute("aria-expanded")).toBe("true");
  });

  it("switching to another trigger replaces the open dropdown immediately", async () => {
    vi.useFakeTimers();
    render(<DocsNavbar />);
    await act(async () => {});

    const contribute = trigger("contribute");
    const github = trigger("github");
    fireEvent.mouseEnter(contribute.parentElement!);
    fireEvent.mouseLeave(contribute.parentElement!);
    fireEvent.mouseEnter(github.parentElement!);

    expect(contribute.getAttribute("aria-expanded")).toBe("false");
    expect(github.getAttribute("aria-expanded")).toBe("true");

    // The stale close timer from "contribute" was cleared, so "github" stays open.
    act(() => {
      vi.advanceTimersByTime(DROPDOWN_HIDE_DELAY_MS * 2);
    });
    expect(github.getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape closes an open dropdown when the palette is not open", async () => {
    vi.useFakeTimers();
    render(<DocsNavbar />);
    await act(async () => {});

    const github = trigger("github");
    fireEvent.mouseEnter(github.parentElement!);
    expect(github.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(github.getAttribute("aria-expanded")).toBe("false");
  });
});
