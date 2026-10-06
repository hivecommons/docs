// @vitest-environment jsdom
//
// Covers src/components/ErrorFallbackUI.tsx (previously 0%) and its two
// wrappers src/app/error.tsx and src/app/global-error.tsx:
//  - the fallback card renders the branded heading, logo, and message
//  - "Try again" invokes the reset callback exactly once per click
//  - recovery links point at the docs entry points
//  - error.tsx renders the fallback with the provided reset
//  - global-error.tsx wraps the fallback in its own <html>/<body> shell
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ErrorFallbackUI from "@/components/ErrorFallbackUI";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";

afterEach(() => {
  cleanup();
});

describe("ErrorFallbackUI", () => {
  it("renders the branded error card", () => {
    render(<ErrorFallbackUI reset={() => {}} />);
    expect(
      screen.getByRole("heading", { name: "Something went wrong" })
    ).toBeTruthy();
    expect(screen.getByText("Hive Commons Docs")).toBeTruthy();
    expect(screen.getByAltText("Hive Commons logo")).toBeTruthy();
    expect(screen.getByText(/temporary runtime error/)).toBeTruthy();
  });

  it("invokes reset when Try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorFallbackUI reset={reset} />);
    const btn = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(btn);
    expect(reset).toHaveBeenCalledTimes(1);
    fireEvent.click(btn);
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("offers recovery links into the docs", () => {
    render(<ErrorFallbackUI reset={() => {}} />);
    const hrefs = new Map(
      screen
        .getAllByRole("link")
        .map(a => [a.textContent, a.getAttribute("href")])
    );
    expect(hrefs.get("Hive intro")).toBe("/docs/hive/readme");
    expect(hrefs.get("Docs home")).toBe("/docs");
    expect(hrefs.get("Community meetings")).toBe("/docs/community/meetings");
  });

  it("ships theme variables for both light and dark shells", () => {
    const html = renderToString(<ErrorFallbackUI reset={() => {}} />);
    expect(html).toContain(":root, html.dark");
    expect(html).toContain("html:not(.dark)");
  });
});

describe("app error boundaries", () => {
  it("error.tsx renders the fallback wired to reset", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("global-error.tsx renders a full html document around the fallback", () => {
    const html = renderToString(
      <GlobalError error={new Error("boom")} reset={() => {}} />
    );
    expect(html).toContain("<html");
    expect(html).toContain("Something went wrong");
  });
});
