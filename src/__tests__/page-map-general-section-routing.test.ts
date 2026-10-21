import { describe, expect, it } from "vitest";
import {
  buildPageMap,
  getBasePath,
  isGeneralSectionFile,
} from "../app/docs/page-map";
import type { ProjectId } from "../config/versions";

/**
 * Pins the general-section routing contract of buildPageMap(): the shared
 * "Community" section (docs/content/community/*) is routed at
 * /docs/community/... for EVERY project, never under the project base path
 * (/docs/pluk/community/...).
 *
 * Two independent mechanisms in page-map.ts decide this and can drift apart:
 *   - the top-level Folder route checks the category TITLE against
 *     ['Contributing', 'Community', 'News'];
 *   - each page route checks the FILE PATH prefix against
 *     GENERAL_SECTION_DIRS ('contributing/', 'community/', 'news/').
 * Fifteen-odd UI suites hard-code "/docs/community/meetings" as the expected
 * href, and the search-route suites mock buildPageMap entirely, so until now
 * nothing asserted that the real page map produces those routes. A regression
 * in either mechanism would 404 every community link with CI still green.
 */

type PageNode = {
  kind: "Folder" | "MdxPage" | "Meta";
  name?: string;
  route?: string;
  children?: PageNode[];
};

type BuildResult = {
  pageMap: PageNode[];
  routeMap: Record<string, string>;
  filePaths: string[];
};

const PROJECT_IDS: ProjectId[] = [
  "hive",
  "hotshot",
  "pluk",
  "rationguard",
  "promptargs",
  "dibs",
  "spektacular",
];

const COMMUNITY_PAGES: Array<[name: string, slug: string, file: string]> = [
  [
    "What is Hive Commons?",
    "what-is-hive-commons",
    "community/what-is-hive-commons.md",
  ],
  ["Join Hive Commons", "join-hive-commons", "community/join-hive-commons.md"],
  ["Community meetings", "meetings", "community/meetings.md"],
];

function flatten(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap(n => [n, ...flatten(n.children || [])]);
}

describe("buildPageMap — general-section routing", () => {
  describe.each(PROJECT_IDS)("project %s", projectId => {
    const result = buildPageMap(projectId) as unknown as BuildResult;
    const community = result.pageMap.find(
      n => n.kind === "Folder" && n.name === "Community"
    );

    it("routes the Community folder at /docs/community, not under the project base path", () => {
      expect(community).toBeDefined();
      expect(community?.route).toBe("/docs/community");
      expect(community?.route).not.toContain(`/${getBasePath(projectId)}/`);
    });

    it.each(COMMUNITY_PAGES)(
      'routes "%s" at /docs/community/%s',
      (name, slug, file) => {
        const page = flatten(community?.children || []).find(
          n => n.kind === "MdxPage" && n.name === name
        );
        expect(page?.route).toBe(`/docs/community/${slug}`);
        // The page route lives under its own folder route, so the folder
        // (title-based) and page (path-based) mechanisms agree.
        expect(page?.route?.startsWith(`${community?.route}/`)).toBe(true);
        expect(result.routeMap[`community/${slug}`]).toBe(file);
        expect(result.filePaths).toContain(file);
      }
    );

    it("lists the Community section after the project-specific sections", () => {
      const folders = result.pageMap.filter(n => n.kind === "Folder");
      expect(folders.length).toBeGreaterThan(1);
      expect(folders[folders.length - 1]?.name).toBe("Community");
    });

    it("never emits a community route under the project base path", () => {
      const basePath = getBasePath(projectId);
      const leaked = flatten(result.pageMap).filter(
        n =>
          typeof n.route === "string" &&
          n.route.startsWith(`/${basePath}/community`)
      );
      expect(leaked).toEqual([]);
    });
  });

  it("isGeneralSectionFile accepts every general-section dir and rejects project files", () => {
    expect(isGeneralSectionFile("community/meetings.md")).toBe(true);
    expect(isGeneralSectionFile("contributing/guide.md")).toBe(true);
    expect(isGeneralSectionFile("news/2026-01-release.mdx")).toBe(true);
    expect(isGeneralSectionFile("architecture.md")).toBe(false);
    expect(isGeneralSectionFile("security/securing-your-hive.md")).toBe(false);
    // Prefix must be a whole path segment.
    expect(isGeneralSectionFile("community-notes.md")).toBe(false);
    expect(isGeneralSectionFile("newsletter/intro.md")).toBe(false);
  });
});
