"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Shared hide delay (ms) for hover-based dropdown menus across the navbar
 * package. Keeping a single constant avoids the tuning drift that occurs
 * when each dropdown implementation hardcodes its own timeout value.
 */
export const DROPDOWN_HIDE_DELAY_MS = 300;

/**
 * Generic hover-based dropdown state manager: tracks which named dropdown
 * (if any) is open, debounces the close on mouse-leave via
 * `DROPDOWN_HIDE_DELAY_MS`, and lets the currently-open menu cancel a
 * pending close when the pointer re-enters it. Used by React-state-driven
 * dropdown UIs (e.g. `DocsNavbar`) that render menus conditionally rather
 * than via imperative DOM queries.
 */
export function useHoverDropdown<T extends string>() {
  const [openDropdown, setOpenDropdown] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(
    (dropdown: T) => {
      clearHideTimeout();
      setOpenDropdown(dropdown);
    },
    [clearHideTimeout]
  );

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, DROPDOWN_HIDE_DELAY_MS);
  }, []);

  const handleDropdownMouseEnter = useCallback(() => {
    clearHideTimeout();
  }, [clearHideTimeout]);

  const closeDropdown = useCallback(() => {
    clearHideTimeout();
    setOpenDropdown(null);
  }, [clearHideTimeout]);

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  return {
    openDropdown,
    handleMouseEnter,
    handleMouseLeave,
    handleDropdownMouseEnter,
    closeDropdown,
  };
}
