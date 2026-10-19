import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { PROJECTS, type ProjectId } from "@/config/versions";
import { buildPageMap, docsContentPath } from "@/app/docs/page-map";

const SITE_URL = "https://docs.hivecommons.dev";

/** Weekly update frequency for docs content */
const DOCS_CHANGE_FREQ = "weekly" as const;

/** Priority for the effective site landing page */
const HOMEPAGE_PRIORITY = 1.0;
/** Priority for project landing pages */
const DOCS_ROOT_PRIORITY = 0.9;
/** Priority for individual docs pages */
const DOCS_PAGE_PRIORITY = 0.7;

/**
 * `/`, `/en`, `/docs` and `/docs/<project>` only redirect, so the canonical
 * redirect targets carry their priority instead.
 */
const PRIORITY_OVERRIDES = new Map<string, number>([
  [`${SITE_URL}/docs/community/what-is-hive-commons`, HOMEPAGE_PRIORITY],
  ...Object.values(PROJECTS).map(
    project =>
      [
        `${SITE_URL}/docs/${project.basePath}/overview/introduction`,
        DOCS_ROOT_PRIORITY,
      ] as [string, number]
  ),
]);

type PageMapNode = {
  route?: string;
  children?: PageMapNode[];
  kind?: string;
};

/** Collect routes of real pages (not folders/meta) that the navigation links to. */
function collectPageRoutes(nodes: PageMapNode[], routes: string[] = []) {
  for (const node of nodes) {
    if (node.children) {
      collectPageRoutes(node.children, routes);
    } else if (node.kind === "MdxPage" && node.route?.startsWith("/docs/")) {
      routes.push(node.route);
    }
  }
  return routes;
}

/**
 * Get the last modified date for a file, falling back to current date.
 */
function getLastModified(filePath: string): Date {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch {
    return new Date();
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  // --- Project-specific docs ---
  const projectIds: ProjectId[] = [
    "hive",
    "hotshot",
    "pluk",
    "rationguard",
    "promptargs",
    "dibs",
    "spektacular",
  ];

  for (const projectId of projectIds) {
    const { pageMap, routeMap, contentPath } = buildPageMap(projectId);
    const projectPrefix = `/docs/${PROJECTS[projectId].basePath}/`;

    for (const route of collectPageRoutes(pageMap as PageMapNode[])) {
      const isProjectRoute = route.startsWith(projectPrefix);
      const key = route.slice(
        isProjectRoute ? projectPrefix.length : "/docs/".length
      );
      const file = routeMap[key];
      const url = `${SITE_URL}${route}`;
      // General sections appear in every project's nav; list them once.
      if (!file || seen.has(url)) continue;
      seen.add(url);

      entries.push({
        url,
        lastModified: getLastModified(
          path.join(isProjectRoute ? contentPath : docsContentPath, file)
        ),
        changeFrequency: DOCS_CHANGE_FREQ,
        priority: PRIORITY_OVERRIDES.get(url) ?? DOCS_PAGE_PRIORITY,
      });
    }
  }

  return entries;
}
