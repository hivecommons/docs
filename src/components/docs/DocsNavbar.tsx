"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
// import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { VersionSelector } from './VersionSelector';

type DropdownType = "contribute" | "community" | "language" | "github" | null;

export default function DocsNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    title: string;
    url: string;
    category: string;
    snippet: string;
    highlightedSnippet: string;
    matchType: string;
  }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Fallback values shown until shields.io responds.
  const [githubStats, setGithubStats] = useState({
    stars: "30",
    forks: "25",
    watchers: "1",
  });

  // const searchParams = useSearchParams()
  // const pathname = usePathname()
  // const router = useRouter()
  // Note: Version label is now handled by VersionSelector component
  void VERSIONS; // Keep import for reference

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch stats via shields.io JSON endpoints — no rate-limit issues unlike api.github.com
  useEffect(() => {
    const REPO = "hivecommons/hive";
    const SHIELDS_BASE = "https://img.shields.io/github";
    const endpoints: Array<{ key: keyof typeof githubStats; metric: string }> = [
      { key: "stars", metric: "stars" },
      { key: "forks", metric: "forks" },
      { key: "watchers", metric: "watchers" },
    ];

    const fetchStats = async () => {
      const results = await Promise.allSettled(
        endpoints.map(async ({ key, metric }) => {
          const res = await fetch(`${SHIELDS_BASE}/${metric}/${REPO}.json`);
          if (!res.ok) return { key, value: null };
          const data = await res.json();
          return { key, value: data.value as string };
        })
      );

      setGithubStats(prev => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.value) {
            next[r.value.key] = r.value.value;
          }
        }
        return next;
      });
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery("");
          setSearchResults([]);
          setSelectedIndex(0);
        } else {
          setOpenDropdown(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }

      // Navigation in search results
      if (isSearchOpen && searchResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === "Enter" && searchResults[selectedIndex]) {
          e.preventDefault();
          window.location.href = searchResults[selectedIndex].url;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, searchResults, selectedIndex]);

  const handleMouseEnter = (dropdown: DropdownType) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenDropdown(dropdown);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
  };

  const handleDropdownMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const isDark = resolvedTheme === 'dark';
  const [isSearching, setIsSearching] = useState(false);

  const performSearchAPI = async (query: string) => {
    try {
      // Call the search API
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const performSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
    
    // Clear existing debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce search API calls (300ms delay)
    debounceRef.current = setTimeout(() => {
      performSearchAPI(query);
    }, 300);
  };

  if (!mounted) {
    return null;
  }
  
  const buttonClasses = 'text-sm font-medium transition-colors px-2 py-1.5 rounded-md flex items-center gap-1.5 text-ink-2 hover:text-ink hover:bg-bg-2 border-b border-transparent hover:border-honey-deep';
  
  const dropdownClasses = 'absolute left-0 top-full mt-0.5 w-52 rounded-md shadow-xl py-1 border z-50 bg-bg-2 border-line';
  
  const dropdownItemClasses = 'flex items-center px-3 py-2 text-sm transition-colors text-ink-2 hover:text-ink hover:bg-bg-3';

  return (
    <div className="nextra-nav-container sticky top-0 z-30 w-full bg-transparent">
      <div className="nextra-nav-container-blur pointer-events-none absolute z-[-1] h-full w-full border-b border-line bg-bg/85 backdrop-blur-md" />
      
      <div className="mx-auto flex items-center gap-2 h-16 px-4 max-w-[90rem]">
        <Link href="/" className="cursor-pointer inline-flex items-center gap-2">
              <div className="flex-shrink-0 cursor-pointer relative z-10">
                <Image
                  src="/hive-commons-logo.png"
                  alt="Hive Commons logo"
                  width={40}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              </div>
              <span className="hidden sm:inline font-[family-name:var(--font-wordmark)] text-lg text-ink">Hive Commons</span>
            </Link>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-1.5">
          <a
            href="https://hive.hivecommons.dev"
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClasses} cursor-pointer relative hidden xl:flex`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              ></path>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span className="ml-2">Live Demo</span>
          </a>

          
          
          <div 
            className="relative hidden xl:flex" 
            onMouseEnter={() => handleMouseEnter("contribute")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              className={`${buttonClasses} cursor-pointer`}
              aria-haspopup="true"
              aria-expanded={openDropdown === "contribute"}
              onMouseEnter={handleDropdownMouseEnter}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Contribute</span>
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${openDropdown === "contribute" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === "contribute" && (
              <div
                className={dropdownClasses}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
              <a
                href="https://github.com/hivecommons/hive"
                target="_blank"
                rel="noopener noreferrer"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Hive source
              </a>
              <a
                href="https://github.com/hivecommons/hive/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"
                target="_blank"
                rel="noopener noreferrer"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                Good first issues
              </a>
              <a
                href="https://github.com/hivecommons/hive/issues"
                target="_blank"
                rel="noopener noreferrer"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Open issues
              </a>
              <a
                href="https://github.com/hivecommons/hive/security/policy"
                target="_blank"
                rel="noopener noreferrer"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Security policy
              </a>
              </div>
            )}
          </div>

          <div 
            className="relative hidden xl:flex"
            onMouseEnter={() => handleMouseEnter("community")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              className={`${buttonClasses} cursor-pointer`}
              aria-haspopup="true"
              aria-expanded={openDropdown === "community"}
              onMouseEnter={handleDropdownMouseEnter}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Community</span>
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${openDropdown === "community" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === "community" && (
              <div
                className={dropdownClasses}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
              
              
              <Link
                href="/docs/community/what-is-hive-commons"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1010 10A10 10 0 0012 2z" />
                </svg>
                What is Hive Commons?
              </Link>
              <Link
                href="/docs/community/join-hive-commons"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Join Hive Commons
              </Link>
              <a
                href="https://hivecommons.dev/discord/"
                target="_blank"
                rel="noopener noreferrer"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Discord
              </a>
              <a
                href="https://hivecommons.dev/agenda/"
                target="_blank"
                rel="noopener noreferrer"
                className={dropdownItemClasses}
              >
                <svg className="w-5 h-5 mr-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Community meetings
              </a>
              </div>
            )}
          </div>

          <div className="relative hidden xl:flex w-px h-5 bg-line mx-1" />

          {/* Version selector dropdown */}
          <VersionSelector />

          <div 
            className="relative hidden lg:flex  "
            onMouseEnter={() => handleMouseEnter("github")}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={`text-sm transition-colors p-1.5 rounded-md flex items-center gap-1 cursor-pointer ${
                isDark
                  ? 'text-ink-2 hover:text-ink hover:bg-bg-3'
                  : 'text-ink-2 hover:text-ink hover:bg-bg-2'
              }`}
              aria-label="GitHub"
              aria-haspopup="true"
              aria-expanded={openDropdown === "github"}
              onMouseEnter={handleDropdownMouseEnter}
            >
              <a
                href="https://github.com/hivecommons/hive"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${openDropdown === "github" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
            {openDropdown === "github" && (
              <div
                className={`absolute right-0 top-full mt-2 w-44 rounded-md shadow-xl py-1 border z-50 ${
                  isDark 
                    ? 'bg-bg-2 border-line'
                    : 'bg-bg border-line'
                }`}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
              <a
                href="https://github.com/hivecommons/hive"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'text-ink-2 hover:bg-bg-3'
                    : 'text-ink-2 hover:bg-bg-2'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/>
                  </svg>
                  Hive source
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  isDark ? 'bg-bg-3' : 'bg-bg-3'
                }`}>
                  {githubStats.stars}
                </span>
              </a>
              <a
                href="https://github.com/hivecommons/docs"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'text-ink-2 hover:bg-bg-3'
                    : 'text-ink-2 hover:bg-bg-2'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1.75 2.5A1.75 1.75 0 013.5.75h6.586c.464 0 .909.184 1.237.513l2.414 2.414c.329.328.513.773.513 1.237V13.5a1.75 1.75 0 01-1.75 1.75h-9A1.75 1.75 0 011.75 13.5v-11zM3.5 2.25a.25.25 0 00-.25.25v11c0 .138.112.25.25.25h9a.25.25 0 00.25-.25V5.25h-2A1.75 1.75 0 019 3.5v-1.25H3.5z"/>
                  </svg>
                  Docs source
                </span>
              </a>
              <a
                href="https://github.com/hivecommons/hivecommons.github.io"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'text-ink-2 hover:bg-bg-3'
                    : 'text-ink-2 hover:bg-bg-2'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 108 8A8.009 8.009 0 008 0zm6.5 8a6.47 6.47 0 01-.584 2.694H11.61A13.34 13.34 0 0011.875 8c0-.93-.093-1.832-.265-2.694h2.306A6.47 6.47 0 0114.5 8zM8 14.5c-.57 0-1.462-1.03-1.883-3.306h3.766C9.462 13.47 8.57 14.5 8 14.5zm-2.08-4.806A11.75 11.75 0 015.625 8c0-.59.102-1.162.295-1.694h4.16c.193.532.295 1.104.295 1.694 0 .59-.102 1.162-.295 1.694H5.92zM1.5 8c0-.963.213-1.876.584-2.694H4.39A13.34 13.34 0 004.125 8c0 .93.093 1.832.265 2.694H2.084A6.47 6.47 0 011.5 8zM8 1.5c.57 0 1.462 1.03 1.883 3.306H6.117C6.538 2.53 7.43 1.5 8 1.5z"/>
                  </svg>
                  Website source
                </span>
              </a>
              <a
                href="https://github.com/hivecommons"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'text-ink-2 hover:bg-bg-3'
                    : 'text-ink-2 hover:bg-bg-2'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 2.5A2.5 2.5 0 014.5 0h7A2.5 2.5 0 0114 2.5v11a.5.5 0 01-.777.416L8 10.101l-5.223 3.815A.5.5 0 012 13.5v-11z"/>
                  </svg>
                  GitHub organization
                </span>
              </a>
              </div>
            )}
          </div>
        </div>

        <button onClick={() => {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
          className={`hidden md:flex w-80 text-sm transition-colors px-3 py-1.5 rounded-md items-center gap-2 ml-2 cursor-pointer ${
            isDark 
              ? 'text-ink-2 hover:text-ink hover:bg-bg-3 border border-line'
              : 'text-ink-2 hover:text-ink hover:bg-bg-2 border border-line'
          }`}
          aria-label="Search documentation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs">Search docs...</span>
          <kbd className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
            isDark ? 'bg-bg-3 text-ink-2' : 'bg-bg-2 text-ink-3'
          }`}>
            ⌘K
          </kbd>
        </button>

        <button
          onClick={() => {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
          className={`md:hidden p-1.5 rounded-md transition-colors cursor-pointer ${
            isDark 
              ? 'text-ink-2 hover:text-ink hover:bg-bg-3'
              : 'text-ink-2 hover:text-ink hover:bg-bg-2'
          }`}
          aria-label="Search documentation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>


        <button
          className={`xl:hidden p-1.5 rounded-md transition-colors cursor-pointer ${
            isDark 
              ? 'text-ink-2 hover:text-ink hover:bg-bg-3'
              : 'text-ink-2 hover:text-ink hover:bg-bg-2'
          }`}
          aria-label="Toggle menu"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* Command Palette Modal */}
      {isSearchOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery("");
              setSearchResults([]);
            }}
          />
          
          {/* Command Palette */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
            <div 
              ref={commandPaletteRef}
              className={`rounded-lg shadow-2xl border ${
                isDark 
                  ? 'bg-bg-2 border-line' 
                  : 'bg-bg border-line'
              }`}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
                <svg className="w-5 h-5 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => performSearch(e.target.value)}
                  placeholder="Search documentation..."
                  className={`flex-1 bg-transparent outline-none text-base ${
                    isDark ? 'text-ink placeholder-ink-3' : 'text-ink placeholder-ink-3'
                  }`}
                  autoFocus
                />
                <kbd className={`text-xs px-2 py-1 rounded ${
                  isDark ? 'bg-bg-3 text-ink-2' : 'bg-bg-2 text-ink-3'
                }`}>
                  ESC
                </kbd>
              </div>

              {/* Search Results */}
              <div className="max-h-96 overflow-y-auto">
                {searchQuery.trim() === "" ? (
                  <div className="px-4 py-8 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className={`text-sm ${isDark ? 'text-ink-2' : 'text-ink-2'}`}>
                      Search for any word or phrase in the documentation...
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-ink-3' : 'text-ink-3'}`}>
                      Try &quot;kubectl&quot;, &quot;cluster&quot;, &quot;workload&quot;, or &quot;installation&quot;
                    </p>
                  </div>
                ) : isSearching ? (
                  <div className="px-4 py-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-line mb-3"></div>
                    <p className={`text-sm ${isDark ? 'text-ink-2' : 'text-ink-2'}`}>
                      Searching documentation...
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className={`text-sm ${isDark ? 'text-ink-2' : 'text-ink-2'}`}>
                      No results found for &quot;{searchQuery}&quot;
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-ink-3' : 'text-ink-3'}`}>
                      Try different keywords or check spelling
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((result, index) => (
                      <a
                        key={index}
                        href={result.url}
                        className={`block px-4 py-3 transition-colors border-l-2 ${
                          index === selectedIndex
                            ? isDark 
                              ? 'bg-bg-3 border-honey' 
                              : 'bg-bg-2 border-honey'
                            : isDark
                              ? 'hover:bg-bg-3 border-transparent'
                              : 'hover:bg-bg-2 border-transparent'
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 p-1.5 rounded flex-shrink-0 ${
                            isDark ? 'bg-bg-3' : 'bg-bg-3'
                          }`}>
                            <svg className="w-4 h-4 text-ink-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`font-medium text-sm ${
                                isDark ? 'text-ink' : 'text-ink'
                              }`}>
                                {result.title}
                              </div>
                              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                isDark ? 'bg-bg-3 text-ink-2' : 'bg-bg-3 text-ink-2'
                              }`}>
                                {result.category}
                              </span>
                            </div>
                            <div 
                              className={`text-xs leading-relaxed ${
                                isDark ? 'text-ink-2' : 'text-ink-2'
                              }`}
                              dangerouslySetInnerHTML={{ 
                                __html: result.highlightedSnippet.replace(
                                  /<mark>/g, 
                                  `<mark style="background-color: ${isDark ? '#fbbf24' : '#fef08a'}; color: ${isDark ? '#000' : '#000'}; padding: 2px 4px; border-radius: 2px; font-weight: 500;">`
                                )
                              }}
                            />
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {searchResults.length > 0 && (
                <div className={`flex items-center justify-between px-4 py-2 text-xs border-t ${
                  isDark 
                    ? 'border-line text-ink-3' 
                    : 'border-line text-ink-2'
                }`}>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-bg-3' : 'bg-bg-2'}`}>↑</kbd>
                      <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-bg-3' : 'bg-bg-2'}`}>↓</kbd>
                      to navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-bg-3' : 'bg-bg-2'}`}>↵</kbd>
                      to select
                    </span>
                  </div>
                  <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {isMenuOpen && (
        <div className={`xl:hidden border-t ${
          isDark ? 'border-line bg-bg' : 'border-line bg-bg'
        }`}>
          <div className="px-4 py-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <a href="https://hive.hivecommons.dev" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Live Demo
            </a>
            
            
            <div className={`text-sm font-medium uppercase px-2 py-1.5 mt-3 tracking-wider ${
              isDark ? 'text-ink-2' : 'text-ink-3'
            }`}>Contribute</div>
            <a href="https://github.com/hivecommons/hive" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Hive source
            </a>
            <a href="https://github.com/hivecommons/hive/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              Good first issues
            </a>
            <a href="https://github.com/hivecommons/hive/issues" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Open issues
            </a>
            <a href="https://github.com/hivecommons/hive/security/policy" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Security policy
            </a>
            
            <div className={`text-sm font-medium uppercase px-2 py-1.5 mt-3 tracking-wider ${
              isDark ? 'text-ink-2' : 'text-ink-3'
            }`}>Community</div>
            <Link href="/docs/community/what-is-hive-commons" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1010 10A10 10 0 0012 2z" />
              </svg>
              What is Hive Commons?
            </Link>
            <Link href="/docs/community/join-hive-commons" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Join Hive Commons
            </Link>
            <a href="https://hivecommons.dev/discord/" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Discord
            </a>
            <a href="https://hivecommons.dev/agenda/" target="_blank" rel="noopener noreferrer" className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
              isDark
                ? 'text-ink-2 hover:bg-bg-3'
                : 'text-ink-2 hover:bg-bg-2'
            }`}>
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Community meetings
            </a>

            {/* Version selector - mobile */}
            <div className={`md:hidden pt-3 border-t mt-3 ${
              isDark ? 'border-line' : 'border-line'
            }`}>
              <VersionSelector isMobile={true} />
            </div>

            <div className={`pt-3 border-t mt-3 ${
              isDark ? 'border-line' : 'border-line'
            }`}>
              <a
                href="https://github.com/hivecommons/hive"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                  isDark
                    ? 'text-ink-2 hover:bg-bg-3'
                    : 'text-ink-2 hover:bg-bg-2'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Hive source
                <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                  isDark ? 'bg-bg-3' : 'bg-bg-3'
                }`}>
                  {githubStats.stars} ★
                </span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
