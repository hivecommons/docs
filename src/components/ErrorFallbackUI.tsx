"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: "var(--ef-bg)",
    color: "var(--ef-ink)",
    fontFamily:
      'var(--font-inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif)',
  },
  card: {
    width: "min(100%, 48rem)",
    border: "1px solid var(--ef-line)",
    borderRadius: "1.5rem",
    background: "var(--ef-bg-2)",
    boxShadow: "0 24px 80px rgba(0,0,0,.22)",
    padding: "clamp(1.5rem, 5vw, 3rem)",
    textAlign: "center",
  },
  logo: { width: 48, height: 48, margin: "0 auto 1rem", display: "block" },
  eyebrow: {
    color: "var(--ef-honey)",
    fontWeight: 750,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontSize: "0.85rem",
    marginBottom: "0.75rem",
  },
  title: {
    color: "var(--ef-ink)",
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    margin: "0 0 1rem",
  },
  message: { color: "var(--ef-ink-2)", fontSize: "1.05rem", lineHeight: 1.7, margin: "0 auto 1.75rem", maxWidth: "38rem" },
  actions: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem" },
  primary: {
    border: "1px solid var(--ef-honey)",
    background: "var(--ef-honey)",
    color: "var(--ef-honey-ink)",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
    font: "inherit",
    fontWeight: 750,
    cursor: "pointer",
    textDecoration: "none",
  },
  secondary: {
    border: "1px solid var(--ef-line)",
    background: "transparent",
    color: "var(--ef-ink)",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
    fontWeight: 700,
    textDecoration: "none",
  },
};

function ThemeVars() {
  return (
    <style>{`
      :root, html.dark {
        --ef-bg: #14110b;
        --ef-bg-2: #1b170f;
        --ef-ink: #efe7d7;
        --ef-ink-2: #b9ad93;
        --ef-honey: #e0a33a;
        --ef-honey-ink: #14110b;
        --ef-line: #332c1e;
      }
      html:not(.dark) {
        --ef-bg: #f6efe0;
        --ef-bg-2: #efe6d2;
        --ef-ink: #1c1710;
        --ef-ink-2: #5a5040;
        --ef-honey: #b8791a;
        --ef-honey-ink: #fff8e8;
        --ef-line: #d8cbae;
      }
      html, body { margin: 0; padding: 0; background: var(--ef-bg); }
    `}</style>
  );
}

export default function ErrorFallbackUI({ reset }: { reset: () => void }) {
  return (
    <main style={styles.page}>
      <ThemeVars />
      <section style={styles.card} aria-labelledby="runtime-error-title">
        <img src="/hive-commons-logo.png" width="48" height="48" alt="Hive Commons logo" style={styles.logo} />
        <div style={styles.eyebrow}>Hive Commons Docs</div>
        <h1 id="runtime-error-title" style={styles.title}>Something went wrong</h1>
        <p style={styles.message}>
          The docs hit a temporary runtime error. Try again, or jump back into the Hive docs while we recover this page.
        </p>
        <div style={styles.actions}>
          <button type="button" onClick={reset} style={styles.primary}>Try again</button>
          <Link href="/docs/hive/readme" style={styles.secondary}>Hive intro</Link>
          <Link href="/docs" style={styles.secondary}>Docs home</Link>
          <Link href="/docs/community/meetings" style={styles.secondary}>Community meetings</Link>
        </div>
      </section>
    </main>
  );
}
