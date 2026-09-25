// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNavDropdowns } from "../components/navbar/useNavDropdowns";

/**
 * useNavDropdowns wires hover/escape behavior for navbar dropdowns rendered
 * with [data-dropdown] / [data-dropdown-menu] markers, plus language-switcher
 * coordination. These tests build the DOM the hook expects, render the hook,
 * and drive it with real DOM events under fake timers (the hide delay is
 * 300ms).
 */

function buildDropdown(name: string) {
  const container = document.createElement("div");
  container.setAttribute("data-dropdown", name);

  const button = document.createElement("button");
  button.setAttribute("data-dropdown-button", "");
  container.appendChild(button);

  const menu = document.createElement("div");
  menu.setAttribute("data-dropdown-menu", "");
  menu.style.display = "none";
  container.appendChild(menu);

  document.body.appendChild(container);
  return { container, button, menu };
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

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useNavDropdowns", () => {
  it("starts with every dropdown closed", () => {
    buildDropdown("contribute");
    const { result } = renderHook(() => useNavDropdowns());
    expect(result.current).toEqual({
      isDropdownOpen: false,
      isContributeOpen: false,
      isCommunityOpen: false,
      isGithubOpen: false,
    });
  });

  it("opens the hovered dropdown, names it in state, and closes the others", () => {
    const contribute = buildDropdown("contribute");
    const community = buildDropdown("community");
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(contribute.container);
    expect(contribute.menu.style.display).toBe("block");
    expect(contribute.menu.style.visibility).toBe("visible");
    expect(result.current.isDropdownOpen).toBe(true);
    expect(result.current.isContributeOpen).toBe(true);
    expect(result.current.isCommunityOpen).toBe(false);

    // Hovering the second dropdown hides the first and flips the state flags.
    mouseEnter(community.container);
    expect(contribute.menu.style.display).toBe("none");
    expect(community.menu.style.display).toBe("block");
    expect(result.current.isContributeOpen).toBe(false);
    expect(result.current.isCommunityOpen).toBe(true);
  });

  it("flags the github dropdown via its data-dropdown name", () => {
    const github = buildDropdown("github");
    const { result } = renderHook(() => useNavDropdowns());
    mouseEnter(github.container);
    expect(result.current.isGithubOpen).toBe(true);
  });

  it("hides the menu only after the 300ms leave delay", () => {
    const { container, menu } = buildDropdown("contribute");
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(container);
    mouseLeave(container);
    // Not yet — the timeout has not fired.
    advance(299);
    expect(menu.style.display).toBe("block");
    expect(result.current.isDropdownOpen).toBe(true);

    advance(1);
    expect(menu.style.display).toBe("none");
    expect(menu.style.visibility).toBe("hidden");
    expect(result.current.isDropdownOpen).toBe(false);
    expect(result.current.isContributeOpen).toBe(false);
  });

  it("cancels the pending hide when the pointer re-enters the menu", () => {
    const { container, menu } = buildDropdown("contribute");
    renderHook(() => useNavDropdowns());

    mouseEnter(container);
    mouseLeave(container);
    advance(150);
    mouseEnter(menu); // clearHideTimeout path
    advance(1000);
    expect(menu.style.display).toBe("block");
  });

  it("cancels the pending hide when the pointer re-enters the button", () => {
    const { container, button, menu } = buildDropdown("contribute");
    renderHook(() => useNavDropdowns());

    mouseEnter(container);
    mouseLeave(container);
    advance(150);
    mouseEnter(button); // button-level clearHideTimeout path
    advance(1000);
    expect(menu.style.display).toBe("block");
  });

  it("dispatches close-lang-switcher when a dropdown opens", () => {
    const { container } = buildDropdown("contribute");
    const seen = vi.fn();
    document.addEventListener("close-lang-switcher", seen);
    renderHook(() => useNavDropdowns());
    mouseEnter(container);
    expect(seen).toHaveBeenCalledTimes(1);
    document.removeEventListener("close-lang-switcher", seen);
  });

  it("closes every dropdown on Escape", () => {
    const contribute = buildDropdown("contribute");
    const community = buildDropdown("community");
    const { result } = renderHook(() => useNavDropdowns());

    mouseEnter(contribute.container);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(contribute.menu.style.display).toBe("none");
    expect(community.menu.style.display).toBe("none");
    expect(result.current.isDropdownOpen).toBe(false);
    expect(result.current.isContributeOpen).toBe(false);
  });

  it("ignores other keys", () => {
    const { container, menu } = buildDropdown("contribute");
    const { result } = renderHook(() => useNavDropdowns());
    mouseEnter(container);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(menu.style.display).toBe("block");
    expect(result.current.isDropdownOpen).toBe(true);
  });

  it("skips containers without a [data-dropdown-menu] child", () => {
    const bare = document.createElement("div");
    bare.setAttribute("data-dropdown", "contribute");
    document.body.appendChild(bare);
    const { result } = renderHook(() => useNavDropdowns());
    mouseEnter(bare);
    // No menu means no listeners: state stays closed and nothing throws.
    expect(result.current.isDropdownOpen).toBe(false);
  });

  it("removes its listeners on unmount", () => {
    const { container, menu } = buildDropdown("contribute");
    const { unmount } = renderHook(() => useNavDropdowns());
    unmount();
    mouseEnter(container);
    expect(menu.style.display).toBe("none");
  });

  describe("language switcher integration", () => {
    function buildLangSwitcher() {
      const wrap = document.createElement("div");
      wrap.className = "language-switcher-container";
      const button = document.createElement("button");
      wrap.appendChild(button);
      document.body.appendChild(wrap);
      return { wrap, button };
    }

    it("opens the switcher on hover when its listbox is not visible", () => {
      const { wrap, button } = buildLangSwitcher();
      const click = vi.spyOn(button, "click");
      const { result } = renderHook(() => useNavDropdowns());

      mouseEnter(wrap);
      expect(click).toHaveBeenCalledTimes(1);
      expect(result.current.isDropdownOpen).toBe(true);
    });

    it("hides open nav dropdowns when the switcher is hovered", () => {
      const { container, menu } = buildDropdown("contribute");
      const { wrap } = buildLangSwitcher();
      renderHook(() => useNavDropdowns());

      mouseEnter(container);
      expect(menu.style.display).toBe("block");
      mouseEnter(wrap);
      expect(menu.style.display).toBe("none");
    });

    it("closes a visible listbox again after the leave delay", () => {
      const { wrap, button } = buildLangSwitcher();
      const click = vi.spyOn(button, "click");
      const { result } = renderHook(() => useNavDropdowns());

      mouseEnter(wrap); // first click "opens" the switcher
      const listbox = document.createElement("div");
      listbox.setAttribute("role", "listbox");
      document.body.appendChild(listbox);

      mouseLeave(wrap);
      advance(300);
      expect(click).toHaveBeenCalledTimes(2); // second click closes it
      expect(result.current.isDropdownOpen).toBe(false);
    });

    it("resolves close-lang-switcher by clicking the button when the listbox is visible", () => {
      const { button } = buildLangSwitcher();
      const listbox = document.createElement("div");
      listbox.setAttribute("role", "listbox");
      document.body.appendChild(listbox);
      const click = vi.spyOn(button, "click");
      renderHook(() => useNavDropdowns());

      act(() => {
        document.dispatchEvent(new CustomEvent("close-lang-switcher"));
      });
      expect(click).toHaveBeenCalledTimes(1);
    });
  });
});
