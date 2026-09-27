// @vitest-environment jsdom
//
// Covers src/components/docs/MobileTOC.tsx (previously ~52%):
//  - null render when toc is missing or empty
//  - accordion toggle opens and closes the panel (maxHeight/overflow styling)
//  - link click scrolls to the heading, pushes the hash, and closes the panel
//  - link click on a missing heading still closes the panel without touching
//    scroll or history
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MobileTOC } from "@/components/docs/MobileTOC";

const TOC = [
  { id: "intro", value: "Introduction", depth: 2 },
  { id: "usage", value: "Usage", depth: 3 },
];

function addHeading(id: string): HTMLElement {
  const el = document.createElement("h2");
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

function panel(): HTMLElement {
  return screen.getByRole("navigation").parentElement as HTMLElement;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MobileTOC", () => {
  it("renders nothing when toc is undefined or empty", () => {
    const { container: none } = render(<MobileTOC />);
    expect(none.firstChild).toBeNull();
    const { container: empty } = render(<MobileTOC toc={[]} />);
    expect(empty.firstChild).toBeNull();
  });

  it("starts collapsed and toggles open and closed", () => {
    render(<MobileTOC toc={TOC} />);
    expect(panel().style.maxHeight).toBe("0px");
    expect(panel().style.overflow).toBe("hidden");

    const toggle = screen.getByRole("button", { name: /On This Page/ });
    fireEvent.click(toggle);
    expect(panel().style.maxHeight).toBe("400px");
    expect(panel().style.overflow).toBe("auto");

    fireEvent.click(toggle);
    expect(panel().style.maxHeight).toBe("0px");
  });

  it("indents links by depth", () => {
    render(<MobileTOC toc={TOC} />);
    expect(
      screen.getByRole("link", { name: "Introduction" }).style.paddingLeft
    ).toBe("12px"); // depth 2
    expect(screen.getByRole("link", { name: "Usage" }).style.paddingLeft).toBe(
      "28px" // depth 3 → 16px indent step
    );
  });

  it("scrolls to the heading, pushes the hash, and closes on click", () => {
    const intro = addHeading("intro");
    const pushState = vi.spyOn(window.history, "pushState");
    render(<MobileTOC toc={TOC} />);

    fireEvent.click(screen.getByRole("button", { name: /On This Page/ }));
    fireEvent.click(screen.getByRole("link", { name: "Introduction" }));

    expect(intro.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(pushState).toHaveBeenCalledWith(null, "", "#intro");
    expect(panel().style.maxHeight).toBe("0px");
  });

  it("still closes when the heading is missing, without scroll or history", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    render(<MobileTOC toc={TOC} />);

    fireEvent.click(screen.getByRole("button", { name: /On This Page/ }));
    fireEvent.click(screen.getByRole("link", { name: "Usage" }));

    expect(pushState).not.toHaveBeenCalled();
    expect(panel().style.maxHeight).toBe("0px");
  });
});
