// @vitest-environment jsdom
//
// Covers src/components/docs/ThemeToggle.tsx (previously 0%):
//  - pre-mount (SSR) placeholders for both variants render a neutral button
//    with the generic "Toggle theme" label and no theme icons
//  - fixed variant: aria-label/title reflect the resolved theme and clicking
//    toggles dark -> light and light -> dark via setTheme
//  - icon variant: same toggle behavior with the compact styling and
//    "Change theme" title
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const setThemeMock = vi.fn();
let resolvedTheme = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme: setThemeMock }),
}));

import { ThemeToggle } from "@/components/docs/ThemeToggle";

beforeEach(() => {
  setThemeMock.mockReset();
  resolvedTheme = "dark";
});

afterEach(() => {
  cleanup();
});

describe("ThemeToggle pre-mount placeholders", () => {
  // renderToString never runs effects, so `mounted` stays false — this is the
  // exact hydration-mismatch guard path the component ships for SSR.
  it("fixed variant renders a neutral placeholder button", () => {
    const html = renderToString(<ThemeToggle />);
    expect(html).toContain('aria-label="Toggle theme"');
    expect(html).toContain("fixed top-4 right-4");
    expect(html).not.toContain("Switch to");
  });

  it("icon variant renders a neutral placeholder button", () => {
    const html = renderToString(<ThemeToggle variant="icon" />);
    expect(html).toContain('aria-label="Toggle theme"');
    expect(html).not.toContain("fixed top-4");
    expect(html).not.toContain("Switch to");
  });
});

describe("ThemeToggle fixed variant (mounted)", () => {
  it("labels the button for switching to light mode when dark", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: "Switch to light mode" });
    expect(btn.getAttribute("title")).toBe("Switch to light mode");
  });

  it("clicking in dark mode requests the light theme", () => {
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" })
    );
    expect(setThemeMock).toHaveBeenCalledTimes(1);
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("clicking in light mode requests the dark theme", () => {
    resolvedTheme = "light";
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" })
    );
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});

describe("ThemeToggle icon variant (mounted)", () => {
  it("uses the compact styling and Change theme title", () => {
    render(<ThemeToggle variant="icon" />);
    const btn = screen.getByRole("button", { name: "Switch to light mode" });
    expect(btn.getAttribute("title")).toBe("Change theme");
    expect(btn.className).not.toContain("fixed");
  });

  it("toggles from light to dark", () => {
    resolvedTheme = "light";
    render(<ThemeToggle variant="icon" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" })
    );
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("toggles from dark to light", () => {
    render(<ThemeToggle variant="icon" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" })
    );
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
