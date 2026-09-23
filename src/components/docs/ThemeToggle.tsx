"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  variant?: 'fixed' | 'icon';
}

export function ThemeToggle({ variant = 'fixed' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  // Icon-only variant for collapsed sidebar
  if (variant === 'icon') {
    if (!mounted) {
      return (
        <button
          className="p-2 rounded-md text-ink-2"
          aria-label="Toggle theme"
        >
          <div className="w-5 h-5" />
        </button>
      );
    }

    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        title="Change theme"
        className="p-2 rounded-md text-ink-2 hover:bg-bg-2 transition-colors"
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <div className="relative w-5 h-5">
          <Moon 
            className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
              isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
            }`}
          />
          <Sun 
            className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
              !isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
            }`}
          />
        </div>
      </button>
    );
  }

  // Fixed variant (original behavior)
  if (!mounted) {
    return (
      <button
        className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-bg-2 border border-line transition-colors shadow-lg"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-bg-2 hover:bg-bg-3 transition-all duration-300 shadow-lg hover:shadow-xl border border-line"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon - visible in dark mode (click to go light) */}
        <Sun 
          className={`absolute inset-0 w-5 h-5 text-honey transition-all duration-300 ${
            isDark 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-0'
          }`}
        />
        {/* Moon icon - visible in light mode (click to go dark) */}
        <Moon 
          className={`absolute inset-0 w-5 h-5 text-ink-2 dark:text-ink-2 transition-all duration-300 ${
            !isDark 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-0'
          }`}
        />
      </div>
    </button>
  );
}
