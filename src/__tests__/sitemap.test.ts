import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import sitemap from "../app/sitemap";

const SITE_URL = "https://docs.hivecommons.dev";

describe("sitemap", () => {
  it("uses absolute production URLs for marketing and docs landing routes", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/en`);
    expect(urls).toContain(`${SITE_URL}/docs`);
    expect(
      urls.every(url => url.startsWith(`${SITE_URL}/`) || url === SITE_URL)
    ).toBe(true);
  });

  it("includes project roots and markdown-backed docs routes", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/docs/hive`,
        `${SITE_URL}/docs/hive/overview/architecture`,
        `${SITE_URL}/docs/hive/reference/architecture-decision-records/0001-record-architecture-decisions`,
        `${SITE_URL}/docs/hotshot`,
        `${SITE_URL}/docs/pluk`,
        `${SITE_URL}/docs/rationguard`,
        `${SITE_URL}/docs/promptargs`,
        `${SITE_URL}/docs/dibs`,
        `${SITE_URL}/docs/spektacular`,
      ])
    );
  });

  it("includes shared general sections once and omits unlinked file-path routes", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/docs/community/meetings`,
        `${SITE_URL}/docs/community/join-hive-commons`,
        `${SITE_URL}/docs/community/what-is-hive-commons`,
      ])
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).not.toContain(`${SITE_URL}/docs/hive/architecture`);
    expect(urls).not.toContain(`${SITE_URL}/docs/hive/community/meetings`);
  });

  it("does not include shared partials or image assets as docs pages", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).not.toContain(`${SITE_URL}/docs/common-subs/coming-soon`);
    expect(urls.some(url => url.includes("/common-subs/"))).toBe(false);
    expect(urls.some(url => url.includes("/images/"))).toBe(false);
  });
});

describe("sitemap generated from fixture content", () => {
  const realCwd = process.cwd();
  let fixtureRoot: string | undefined;

  function write(relPath: string, content = "# stub\n") {
    if (!fixtureRoot) throw new Error("fixtureRoot not initialized");
    const full = path.join(fixtureRoot, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    if (fixtureRoot) {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("maps navigation-linked files to routes, priorities, frequencies, and mtimes", () => {
    fixtureRoot = fs.mkdtempSync(path.join(realCwd, ".sitemap-fixture-"));
    const archPath = write("docs/content/hive/architecture.md");
    write("docs/content/hive/unlinked/page.md");
    vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);

    const entries = sitemap();
    const byUrl = new Map(entries.map(entry => [entry.url, entry]));
    const arch = byUrl.get(`${SITE_URL}/docs/hive/overview/architecture`);

    expect(byUrl.get(SITE_URL)?.priority).toBe(1.0);
    expect(byUrl.get(`${SITE_URL}/en`)?.changeFrequency).toBe("monthly");
    expect(byUrl.get(`${SITE_URL}/docs`)?.priority).toBe(0.9);
    expect(byUrl.get(`${SITE_URL}/docs/hive`)?.priority).toBe(0.9);
    expect(arch?.priority).toBe(0.7);
    expect(arch?.changeFrequency).toBe("weekly");
    expect(arch?.lastModified).toEqual(fs.statSync(archPath).mtime);
    expect(byUrl.has(`${SITE_URL}/docs/hive/architecture`)).toBe(false);
    expect(byUrl.has(`${SITE_URL}/docs/hive/unlinked/page`)).toBe(false);
  });

  it("omits generated routes for missing content while retaining project roots", () => {
    fixtureRoot = fs.mkdtempSync(path.join(realCwd, ".sitemap-empty-"));
    vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);

    const entries = sitemap();

    expect(entries.some(entry => entry.url.includes("/docs/hive/"))).toBe(
      false
    );
    expect(entries.map(entry => entry.url)).toEqual(
      expect.arrayContaining([
        SITE_URL,
        `${SITE_URL}/en`,
        `${SITE_URL}/docs`,
        `${SITE_URL}/docs/hive`,
        `${SITE_URL}/docs/hotshot`,
        `${SITE_URL}/docs/pluk`,
        `${SITE_URL}/docs/rationguard`,
        `${SITE_URL}/docs/promptargs`,
        `${SITE_URL}/docs/dibs`,
        `${SITE_URL}/docs/spektacular`,
      ])
    );
  });
});
