// @vitest-environment jsdom
//
// Covers src/components/docs/TableOfContents.tsx (previously ~34%):
//  - null render when toc is missing or empty
//  - depth-based indentation of TOC links
//  - IntersectionObserver scroll-spy: active heading gets highlight styling,
//    only existing heading elements are observed, observer disconnects on
//    unmount
//  - link click scrolls smoothly to the heading and pushes the hash without
//    jumping; missing headings neither scroll nor touch history
//  - "Back to top" scrolls to the top of the page
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TableOfContents } from "@/components/docs/TableOfContents";

type ObserverCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

let observerCallback: ObserverCallback | undefined;
const observed: Element[] = [];
const disconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe(el: Element) {
    observed.push(el);
  }
  disconnect = disconnect;
  unobserve() {}
}

const TOC = [
  { id: "intro", value: "Introduction", depth: 2 },
  { id: "usage", value: "Usage", depth: 3 },
  { id: "faq", value: "FAQ", depth: 2 },
];

function addHeading(id: string): HTMLElement {
  const el = document.createElement("h2");
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  observerCallback = undefined;
  observed.length = 0;
  disconnect.mockClear();
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TableOfContents", () => {
  it("renders nothing when toc is undefined or empty", () => {
    const { container: none } = render(<TableOfContents />);
    expect(none.firstChild).toBeNull();
    const { container: empty } = render(<TableOfContents toc={[]} />);
    expect(empty.firstChild).toBeNull();
  });

  it("renders a link per item with depth-based indentation", () => {
    render(<TableOfContents toc={TOC} />);
    const intro = screen.getByRole("link", { name: "Introduction" });
    const usage = screen.getByRole("link", { name: "Usage" });
    expect(intro.getAttribute("href")).toBe("#intro");
    expect(intro.style.paddingLeft).toBe("12px"); // depth 2 → no extra indent
    expect(usage.style.paddingLeft).toBe("24px"); // depth 3 → one indent step
    expect(screen.getByText("On This Page")).toBeTruthy();
  });

  it("observes only headings that exist in the document", () => {
    addHeading("intro");
    addHeading("faq");
    render(<TableOfContents toc={TOC} />);
    expect(observed.map((el) => el.id)).toEqual(["intro", "faq"]);
  });

  it("highlights the heading reported as intersecting", () => {
    const intro = addHeading("intro");
    render(<TableOfContents toc={TOC} />);

    const link = () => screen.getByRole("link", { name: "Introduction" });
    expect(link().className).toContain("border-transparent");

    expect(observerCallback).toBeDefined();
    // Simulate the heading scrolling into the active zone.
    act(() => {
      observerCallback!([{ isIntersecting: true, target: intro }]);
    });
    expect(link().className).toContain("border-honey");
    // Non-intersecting entries must not steal the highlight.
    act(() => {
      observerCallback!([{ isIntersecting: false, target: addHeading("faq") }]);
    });
    expect(link().className).toContain("border-honey");
  });

  it("disconnects the observer on unmount", () => {
    addHeading("intro");
    const { unmount } = render(<TableOfContents toc={TOC} />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("scrolls to the heading and pushes the hash on click", () => {
    const intro = addHeading("intro");
    const pushState = vi.spyOn(window.history, "pushState");
    render(<TableOfContents toc={TOC} />);

    fireEvent.click(screen.getByRole("link", { name: "Introduction" }));

    expect(intro.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(pushState).toHaveBeenCalledWith(null, "", "#intro");
  });

  it("does nothing on click when the heading is missing", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    render(<TableOfContents toc={TOC} />);

    fireEvent.click(screen.getByRole("link", { name: "FAQ" }));

    expect(pushState).not.toHaveBeenCalled();
  });

  it("scrolls to the top via the back-to-top link", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    render(<TableOfContents toc={TOC} />);

    fireEvent.click(screen.getByRole("link", { name: "↑ Back to top" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
