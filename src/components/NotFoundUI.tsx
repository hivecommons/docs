"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import type { CSSProperties } from "react";

// The 404 page must survive deploy propagation windows where hashed CSS can be
// unavailable, so it mirrors the docs theme with inline styles and CSS custom
// properties instead of Tailwind classes.

type SearchResult = {
  title: string;
  url: string;
  category: string;
  snippet: string;
};

type QuickLink = {
  href: string;
  label: string;
  primary?: boolean;
};

const HIVE_LINKS: QuickLink[] = [
  { href: "/docs/hive/readme", label: "Hive intro", primary: true },
  { href: "/docs/hive/getting-started", label: "Getting Started" },
  { href: "/docs/hive/documentation-map", label: "Documentation map" },
  { href: "/docs/community/meetings", label: "Community meetings" },
  { href: "/docs", label: "Docs home" },
];

const GENERAL_LINKS: QuickLink[] = [
  { href: "/docs", label: "Docs home", primary: true },
  { href: "/docs/community/what-is-hive-commons", label: "What is Hive Commons?" },
  { href: "/docs/community/join-hive-commons", label: "Join Hive Commons" },
  { href: "/docs/community/meetings", label: "Community meetings" },
  { href: "https://github.com/hivecommons", label: "GitHub" },
];

const LOGO_SIZE = 44;
const MAX_RESULTS = 5;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--nf-page-backdrop)",
    backgroundSize: "auto, auto, 56px 97px, auto",
    backgroundRepeat: "no-repeat, no-repeat, repeat, no-repeat",
    color: "var(--nf-ink)",
    fontFamily:
      'var(--font-inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif)',
  },
  header: {
    borderBottom: "1px solid var(--nf-line)",
    background: "color-mix(in srgb, var(--nf-bg) 86%, transparent)",
    backdropFilter: "blur(14px)",
  },
  headerInner: {
    maxWidth: "88rem",
    margin: "0 auto",
    padding: "1rem 1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.7rem",
    color: "var(--nf-ink)",
    fontWeight: 700,
    fontSize: "1.1rem",
    textDecoration: "none",
  },
  docsLink: {
    color: "var(--nf-ink-2)",
    fontSize: "0.95rem",
    textDecoration: "none",
  },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "88rem",
    margin: "0 auto",
    padding: "clamp(2.5rem, 7vw, 6rem) 1.5rem",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
    gap: "2rem",
    alignItems: "center",
  },
  panel: {
    border: "1px solid var(--nf-line)",
    borderRadius: "1.5rem",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--nf-bg-2) 94%, transparent), color-mix(in srgb, var(--nf-bg) 86%, transparent))",
    boxShadow: "0 24px 80px color-mix(in srgb, var(--nf-shadow) 38%, transparent)",
    padding: "clamp(1.5rem, 4vw, 3rem)",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--nf-honey)",
    fontSize: "0.85rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "1rem",
  },
  code: {
    color: "var(--nf-honey)",
    fontSize: "clamp(4rem, 14vw, 8rem)",
    fontWeight: 800,
    lineHeight: 0.9,
    letterSpacing: "-0.06em",
    margin: "0 0 1rem",
    textShadow: "0 0 40px color-mix(in srgb, var(--nf-honey) 34%, transparent)",
  },
  heading: {
    color: "var(--nf-ink)",
    fontSize: "clamp(2rem, 5vw, 4.5rem)",
    lineHeight: 1.03,
    letterSpacing: "-0.05em",
    margin: "0 0 1rem",
  },
  message: {
    color: "var(--nf-ink-2)",
    fontSize: "1.1rem",
    lineHeight: 1.7,
    margin: "0 0 1.5rem",
  },
  pathBox: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
    maxWidth: "100%",
    padding: "0.65rem 0.8rem",
    borderRadius: "0.75rem",
    border: "1px solid var(--nf-line)",
    background: "color-mix(in srgb, var(--nf-bg-3) 72%, transparent)",
    marginBottom: "1.5rem",
  },
  pathLabel: { color: "var(--nf-ink-3)", fontSize: "0.85rem" },
  pathValue: {
    color: "var(--nf-honey)",
    fontSize: "0.85rem",
    overflowWrap: "anywhere",
    fontFamily:
      "var(--font-jetbrains-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    marginTop: "1.5rem",
  },
  buttonPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "2.75rem",
    padding: "0.75rem 1rem",
    borderRadius: "0.75rem",
    border: "1px solid var(--nf-honey)",
    background: "var(--nf-honey)",
    color: "var(--nf-honey-ink)",
    fontWeight: 700,
    textDecoration: "none",
  },
  buttonSecondary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "2.75rem",
    padding: "0.75rem 1rem",
    borderRadius: "0.75rem",
    border: "1px solid var(--nf-line)",
    background: "color-mix(in srgb, var(--nf-bg-2) 70%, transparent)",
    color: "var(--nf-ink)",
    fontWeight: 650,
    textDecoration: "none",
  },
  sidePanel: {
    border: "1px solid var(--nf-line)",
    borderRadius: "1.25rem",
    background: "color-mix(in srgb, var(--nf-bg-2) 82%, transparent)",
    padding: "1.25rem",
  },
  sideTitle: {
    color: "var(--nf-ink)",
    fontSize: "1rem",
    fontWeight: 750,
    margin: "0 0 0.75rem",
  },
  linkList: {
    display: "grid",
    gap: "0.65rem",
    margin: "0 0 1.25rem",
    padding: 0,
    listStyle: "none",
  },
  listLink: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.75rem 0.85rem",
    borderRadius: "0.75rem",
    border: "1px solid var(--nf-line)",
    color: "var(--nf-ink)",
    background: "color-mix(in srgb, var(--nf-bg) 64%, transparent)",
    textDecoration: "none",
    fontWeight: 650,
  },
  searchForm: { display: "flex", gap: "0.5rem", marginBottom: "0.75rem" },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: "1px solid var(--nf-line)",
    borderRadius: "0.75rem",
    background: "var(--nf-bg)",
    color: "var(--nf-ink)",
    padding: "0.75rem 0.85rem",
    font: "inherit",
  },
  searchButton: {
    border: "1px solid var(--nf-honey)",
    borderRadius: "0.75rem",
    background: "var(--nf-honey)",
    color: "var(--nf-honey-ink)",
    padding: "0.75rem 0.95rem",
    font: "inherit",
    fontWeight: 750,
    cursor: "pointer",
  },
  searchHint: { color: "var(--nf-ink-3)", fontSize: "0.9rem", margin: "0" },
  resultLink: {
    display: "block",
    padding: "0.75rem 0",
    color: "var(--nf-ink)",
    textDecoration: "none",
    borderTop: "1px solid var(--nf-line)",
  },
  resultMeta: { color: "var(--nf-honey)", fontSize: "0.8rem", marginBottom: "0.2rem" },
  resultSnippet: { color: "var(--nf-ink-2)", fontSize: "0.9rem", lineHeight: 1.5, margin: "0.25rem 0 0" },
  footer: {
    borderTop: "1px solid var(--nf-line)",
    padding: "1rem 1.5rem",
    color: "var(--nf-ink-3)",
    textAlign: "center",
    fontSize: "0.9rem",
  },
};

function ThemeVars() {
  return (
    <style>{`
      :root, html.dark {
        --nf-bg: #14110b;
        --nf-bg-2: #1b170f;
        --nf-bg-3: #221c11;
        --nf-ink: #efe7d7;
        --nf-ink-2: #b9ad93;
        --nf-ink-3: #7d7460;
        --nf-honey: #e0a33a;
        --nf-honey-deep: #b8791a;
        --nf-honey-ink: #14110b;
        --nf-line: #332c1e;
        --nf-shadow: #000000;
        --nf-honeycomb-glow: #2a2113;
        --nf-honeycomb-tile: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cpath d='M28 1l27 15.5v31L28 63 1 47.5v-31zM28 34l27 15.5v31L28 96 1 80.5v-31z' fill='none' stroke='%23e0a33a' stroke-opacity='.07'/%3E%3C/svg%3E");
      }
      @media (prefers-color-scheme: light) {
        :root:not(.dark) {
          --nf-bg: #f6efe0;
          --nf-bg-2: #efe6d2;
          --nf-bg-3: #e8ddc4;
          --nf-ink: #1c1710;
          --nf-ink-2: #5a5040;
          --nf-ink-3: #8a7f68;
          --nf-honey: #b8791a;
          --nf-honey-deep: #8f5c10;
          --nf-honey-ink: #fff8e8;
          --nf-line: #d8cbae;
          --nf-shadow: #8f5c10;
          --nf-honeycomb-glow: #ecdcb4;
          --nf-honeycomb-tile: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cpath d='M28 1l27 15.5v31L28 63 1 47.5v-31zM28 34l27 15.5v31L28 96 1 80.5v-31z' fill='none' stroke='%23b8791a' stroke-opacity='.09'/%3E%3C/svg%3E");
        }
      }
      html:not(.dark) {
        --nf-bg: #f6efe0;
        --nf-bg-2: #efe6d2;
        --nf-bg-3: #e8ddc4;
        --nf-ink: #1c1710;
        --nf-ink-2: #5a5040;
        --nf-ink-3: #8a7f68;
        --nf-honey: #b8791a;
        --nf-honey-deep: #8f5c10;
        --nf-honey-ink: #fff8e8;
        --nf-line: #d8cbae;
        --nf-shadow: #8f5c10;
        --nf-honeycomb-glow: #ecdcb4;
        --nf-honeycomb-tile: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cpath d='M28 1l27 15.5v31L28 63 1 47.5v-31zM28 34l27 15.5v31L28 96 1 80.5v-31z' fill='none' stroke='%23b8791a' stroke-opacity='.09'/%3E%3C/svg%3E");
      }
      :root {
        --nf-page-backdrop:
          radial-gradient(80% 70% at 75% 12%, transparent 10%, var(--nf-bg) 100%),
          radial-gradient(900px 520px at 78% 0%, var(--nf-honeycomb-glow) 0%, transparent 62%),
          var(--nf-honeycomb-tile),
          var(--nf-bg);
      }
      html, body { margin: 0; padding: 0; background: var(--nf-bg); }
      a:focus-visible, button:focus-visible, input:focus-visible {
        outline: 2px solid var(--nf-honey);
        outline-offset: 3px;
      }
    `}</style>
  );
}

function Brand() {
  return (
    <Link href="/docs" style={styles.brand}>
      <img
        src="/hive-commons-logo.png"
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        alt="Hive Commons logo"
        style={{ display: "block", width: LOGO_SIZE, height: LOGO_SIZE }}
      />
      <span>Hive Commons Docs</span>
    </Link>
  );
}

function isExternal(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <ul style={styles.linkList}>
      {links.map((link) => (
        <li key={link.href}>
          {isExternal(link.href) ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer" style={styles.listLink}>
              <span>{link.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <Link href={link.href} style={styles.listLink}>
              <span>{link.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function NotFoundUI() {
  const pathname = usePathname();
  const isHiveDocs = pathname?.startsWith("/docs/hive/") || pathname === "/docs/hive";
  const quickLinks = isHiveDocs ? HIVE_LINKS : GENERAL_LINKS;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const message = useMemo(() => {
    if (isHiveDocs) {
      return "This page may have moved while we reorganized the Hive docs. Try the Hive docs map, getting started guide, or search below.";
    }
    return "This page may have moved while we reorganized Hive Commons documentation. Try the docs home, community pages, or search below.";
  }, [isHiveDocs]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchState("loading");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as { results?: SearchResult[] };
      setResults((data.results ?? []).slice(0, MAX_RESULTS));
      setSearchState("done");
    } catch {
      setResults([]);
      setSearchState("error");
    }
  }

  return (
    <div style={styles.page}>
      <ThemeVars />
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Brand />
          <Link href="/docs" style={styles.docsLink}>
            Docs home
          </Link>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.panel} aria-labelledby="not-found-title">
          <div style={styles.eyebrow}>Page not found</div>
          <div style={styles.code}>404</div>
          <h1 id="not-found-title" style={styles.heading}>
            This Hive Commons page is not here.
          </h1>
          <p style={styles.message}>{message}</p>

          {pathname && (
            <div style={styles.pathBox}>
              <span style={styles.pathLabel}>Requested path</span>
              <code style={styles.pathValue}>{pathname}</code>
            </div>
          )}

          <div style={styles.actions}>
            {quickLinks.slice(0, 3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={link.primary ? styles.buttonPrimary : styles.buttonSecondary}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <aside style={styles.sidePanel} aria-label="Helpful links and search">
          <h2 style={styles.sideTitle}>{isHiveDocs ? "Hive docs links" : "Helpful links"}</h2>
          <QuickLinks links={quickLinks} />

          <h2 style={styles.sideTitle}>Search the docs</h2>
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <label htmlFor="not-found-search" style={{ position: "absolute", left: "-10000px" }}>
              Search documentation
            </label>
            <input
              id="not-found-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documentation..."
              style={styles.searchInput}
            />
            <button type="submit" style={styles.searchButton}>
              Search
            </button>
          </form>

          {searchState === "idle" && <p style={styles.searchHint}>Search Hive, Spektacular, hotshot, pluk, and other Hive Commons docs.</p>}
          {searchState === "loading" && <p style={styles.searchHint}>Searching…</p>}
          {searchState === "error" && <p style={styles.searchHint}>Search is temporarily unavailable.</p>}
          {searchState === "done" && results.length === 0 && <p style={styles.searchHint}>No matching docs found.</p>}
          {results.map((result) => (
            <Link key={result.url} href={result.url} style={styles.resultLink}>
              <div style={styles.resultMeta}>{result.category}</div>
              <strong>{result.title}</strong>
              <p style={styles.resultSnippet}>{result.snippet}</p>
            </Link>
          ))}
        </aside>
      </main>

      <footer style={styles.footer}>© {new Date().getFullYear()} Hive Commons. Apache 2.0 License.</footer>
    </div>
  );
}
