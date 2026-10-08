import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { PROJECTS, type ProjectId } from "@/config/versions";
import { buildPageMap, docsContentPath } from "@/app/docs/page-map";

const SITE_URL = "https://docs.hivecommons.dev";

/** Weekly update frequency for docs content */
const DOCS_CHANGE_FREQ = "weekly" as const;
/** Monthly update frequency for marketing pages */
const MARKETING_CHANGE_FREQ = "monthly" as const;

/** Priority for the homepage */
const HOMEPAGE_PRIORITY = 1.0;
/** Priority for top-level marketing pages */
const MARKETING_PRIORITY = 0.8;
/** Priority for docs landing / project root pages */
const DOCS_ROOT_PRIORITY = 0.9;
/** Priority for individual docs pages */
const DOCS_PAGE_PRIORITY = 0.7;

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

  // --- Homepage ---
  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: MARKETING_CHANGE_FREQ,
    priority: HOMEPAGE_PRIORITY,
  });

  // --- Marketing / locale pages ---
  const marketingPages = ["/en"];

  for (const page of marketingPages) {
    entries.push({
      url: `${SITE_URL}${page}`,
      lastModified: new Date(),
      changeFrequency: MARKETING_CHANGE_FREQ,
      priority: MARKETING_PRIORITY,
    });
  }

  // --- Docs landing page ---
  entries.push({
    url: `${SITE_URL}/docs`,
    lastModified: new Date(),
    changeFrequency: DOCS_CHANGE_FREQ,
    priority: DOCS_ROOT_PRIORITY,
  });

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
    // Add project root entry
    entries.push({
      url: `${SITE_URL}/docs/${PROJECTS[projectId].basePath}`,
      lastModified: new Date(),
      changeFrequency: DOCS_CHANGE_FREQ,
      priority: DOCS_ROOT_PRIORITY,
    });

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
        priority: DOCS_PAGE_PRIORITY,
      });
    }
  }

  return entries;
}
