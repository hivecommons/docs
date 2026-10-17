// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNavDropdowns } from "../components/navbar/useNavDropdowns";

/**
 * Defensive branches of useNavDropdowns: markup the hook tolerates but the
 * site never renders on purpose (a [data-dropdown] with no menu next to one
 * that has one, a menu with no button, a language switcher with no button,
 * text nodes passing through the MutationObserver). Each case asserts that
 * the hook neither throws nor flips state it should not.
 */

function buildDropdown(name: string, { withButton = true } = {}) {
  const container = document.createElement("div");
  container.setAttribute("data-dropdown", name);

  let button: HTMLButtonElement | null = null;
  if (withButton) {
    button = document.createElement("button");
    button.setAttribute("data-dropdown-button", "");
    container.appendChild(button);
  }

  const menu = document.createElement("div");
  menu.setAttribute("data-dropdown-menu", "");
  menu.style.display = "none";
  container.appendChild(menu);

  document.body.appendChild(container);
  return { container, button, menu };
}

function buildBareDropdown(name: string) {
  const bare = document.createElement("div");
  bare.setAttribute("data-dropdown", name);
  document.body.appendChild(bare);
  return bare;
}

function buildLangSwitcher({ withButton = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "language-switcher-container";
  let button: HTMLButtonElement | null = null;
  if (withButton) {
    button = document.createElement("button");
    wrap.appendChild(button);
  }
  document.body.appendChild(wrap);
  return { wrap, button };
}

function appendListbox() {
  const listbox = document.createElement("div");
  listbox.setAttribute("role", "listbox");
  document.body.appendChild(listbox);
  return listbox;
}

function mouseEnter(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new MouseEvent("mouseenter"));
  });
}

function mouseLeave(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new MouseEvent("mouseleave"));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function flushObservers() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useNavDropdowns guard branches", () => {
  it("opens a dropdown even when a sibling [data-dropdown] has no menu", () => {
    const { container, menu } = buildDropdown("contribute");
    buildBareDropdown("community");
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(container);
    expect(menu.style.display).toBe("block");
    expect(result.current.isContributeOpen).toBe(true);
    expect(result.current.isCommunityOpen).toBe(false);
  });

  it("shows the menu of an unknown dropdown name without naming it in state", () => {
    const { container, menu } = buildDropdown("docs");
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(container);
    expect(menu.style.display).toBe("block");
    expect(result.current).toEqual({
      isDropdownOpen: true,
      isContributeOpen: false,
      isCommunityOpen: false,
      isGithubOpen: false,
    });
  });

  it("works without a [data-dropdown-button]: hover shows, leave hides after the delay", () => {
    const { container, menu } = buildDropdown("community", {
      withButton: false,
    });
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(container);
    expect(menu.style.display).toBe("block");
    expect(result.current.isCommunityOpen).toBe(true);

    mouseLeave(container);
    advance(300);
    expect(menu.style.display).toBe("none");
    expect(result.current.isCommunityOpen).toBe(false);
  });

  it("Escape tolerates a [data-dropdown] without a menu", () => {
    const { container, menu } = buildDropdown("github");
    buildBareDropdown("community");
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(container);
    expect(result.current.isGithubOpen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(menu.style.display).toBe("none");
    expect(result.current.isGithubOpen).toBe(false);
  });

  describe("language switcher", () => {
    it("hovering the switcher tolerates a [data-dropdown] without a menu", () => {
      const { container, menu } = buildDropdown("contribute");
      buildBareDropdown("community");
      const { wrap } = buildLangSwitcher();
      const { result } = renderHook(() => useNavDropdowns());

      mouseEnter(container);
      expect(menu.style.display).toBe("block");

      mouseEnter(wrap);
      expect(menu.style.display).toBe("none");
      expect(result.current.isDropdownOpen).toBe(true);
    });

    it("does nothing on hover when the switcher has no button", () => {
      const { wrap } = buildLangSwitcher({ withButton: false });
      const { result } = renderHook(() => useNavDropdowns());

      mouseEnter(wrap);
      expect(result.current.isDropdownOpen).toBe(false);

      mouseLeave(wrap);
      advance(300);
      expect(result.current.isDropdownOpen).toBe(false);
    });

    it("leaves a visible listbox alone when the pointer never hovered the switcher", () => {
      const { wrap, button } = buildLangSwitcher();
      const click = vi.spyOn(button!, "click");
      const { result } = renderHook(() => useNavDropdowns());

      // Listbox opened by some other means (keyboard), not via hover.
      appendListbox();
      mouseLeave(wrap);
      advance(300);

      expect(click).not.toHaveBeenCalled();
      expect(result.current.isDropdownOpen).toBe(false);
    });

    it("ignores non-element nodes added to or removed from the document", async () => {
      const { wrap } = buildLangSwitcher();
      const { result, unmount } = renderHook(() => useNavDropdowns());

      mouseEnter(wrap);
      expect(result.current.isDropdownOpen).toBe(true);

      const text = document.createTextNode("stray text");
      act(() => {
        document.body.appendChild(text);
      });
      await flushObservers();

      act(() => {
        text.remove();
      });
      await flushObservers();
      expect(result.current.isDropdownOpen).toBe(true);
      unmount();
    });

    it("entering the listbox with no pending hide is a no-op", async () => {
      const { wrap, button } = buildLangSwitcher();
      const click = vi.spyOn(button!, "click");
      const { result, unmount } = renderHook(() => useNavDropdowns());

      mouseEnter(wrap);
      const listbox = appendListbox();
      await flushObservers();

      // No mouseleave has scheduled a hide, so there is nothing to cancel.
      mouseEnter(listbox);
      advance(300);
      expect(click).toHaveBeenCalledTimes(1);
      expect(result.current.isDropdownOpen).toBe(true);
      unmount();
    });
  });
});
