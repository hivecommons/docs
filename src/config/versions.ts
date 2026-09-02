// Multi-project versions config for the Hive Commons docs site
// Supports hive, hotshot, and pluk with independent versioning
//
// Versioning Strategy:
// - Each project has its own version scheme
// - The main branch always contains the latest version for all projects
// - Hive is continuously deployed rather than semver-released, so the docs are
//   a single "latest" line: content is fetched at build time from the hive
//   branch named by HIVE_DOCS_REF (see scripts/sync-hive-docs.ts), which tracks
//   hive's current major release line (v4 today). When hive moves to a new
//   major line, update this label, currentVersion below, and the HIVE_DOCS_REF
//   default together.

// Netlify site name for branch deploys
export const NETLIFY_SITE_NAME = "hivecommons-docs"

// Production URL for latest version
export const PRODUCTION_URL = "https://docs.hivecommons.dev"

// Project identifiers
export type ProjectId = "hive" | "hotshot" | "pluk"

// Version info structure
export interface VersionInfo {
  label: string
  branch: string
  isDefault: boolean
  externalUrl?: string
  isDev?: boolean // marks development/unreleased versions
}

// Project configuration
export interface ProjectConfig {
  id: ProjectId
  name: string
  basePath: string
  currentVersion: string
  contentPath: string
  versions: Record<string, VersionInfo>
}

// hive versions
const HIVE_VERSIONS: Record<string, VersionInfo> = {
  latest: {
    label: "v4 (Latest)",
    branch: "main",
    isDefault: true,
  },
}

// hotshot versions
const HOTSHOT_VERSIONS: Record<string, VersionInfo> = {
  latest: {
    label: "main (Latest)",
    branch: "main",
    isDefault: true,
  },
}

// pluk versions
const PLUK_VERSIONS: Record<string, VersionInfo> = {
  latest: {
    label: "main (Latest)",
    branch: "main",
    isDefault: true,
  },
}

// All projects configuration
export const PROJECTS: Record<ProjectId, ProjectConfig> = {
  hive: {
    id: "hive",
    name: "Hive",
    basePath: "hive",
    currentVersion: "v4",
    contentPath: "docs/content/hive",
    versions: HIVE_VERSIONS,
  },
  hotshot: {
    id: "hotshot",
    name: "hotshot",
    basePath: "hotshot",
    currentVersion: "main",
    contentPath: "docs/content/hotshot",
    versions: HOTSHOT_VERSIONS,
  },
  pluk: {
    id: "pluk",
    name: "pluk",
    basePath: "pluk",
    currentVersion: "main",
    contentPath: "docs/content/pluk",
    versions: PLUK_VERSIONS,
  },
}

// Get project from URL pathname
export function getProjectFromPath(pathname: string): ProjectConfig {
  if (pathname.startsWith("/docs/hotshot")) {
    return PROJECTS.hotshot
  }
  if (pathname.startsWith("/docs/pluk")) {
    return PROJECTS.pluk
  }
  return PROJECTS.hive
}

// Get project by ID
export function getProject(projectId: ProjectId): ProjectConfig {
  return PROJECTS[projectId]
}

// Get all projects
export function getAllProjects(): ProjectConfig[] {
  return Object.values(PROJECTS)
}

// ============================================
// Backwards-compatible exports (hive is the flagship project)
// ============================================

export const CURRENT_VERSION = PROJECTS.hive.currentVersion
export const VERSIONS = HIVE_VERSIONS

export type VersionKey = keyof typeof HIVE_VERSIONS

export function getDefaultVersion(): VersionKey {
  return "latest"
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION
}

export function getBranchForVersion(version: VersionKey): string {
  return HIVE_VERSIONS[version]?.branch ?? "main"
}

export function getVersionFromBranch(branch: string): VersionKey | null {
  // Check if branch matches docs/{version} pattern
  const match = branch.match(/^docs\/(.+)$/)
  if (match) {
    const versionNum = match[1]
    // Find version entry with matching branch
    for (const [key, value] of Object.entries(HIVE_VERSIONS)) {
      if (value.branch === branch || key === versionNum) {
        return key as VersionKey
      }
    }
  }

  // Check for main branch
  if (branch === "main" || branch === "master") {
    return "latest"
  }

  return null
}

export function getAllVersions(): Array<{ key: VersionKey } & VersionInfo> {
  return Object.entries(HIVE_VERSIONS).map(([key, value]) => ({
    key: key as VersionKey,
    ...value,
  }))
}

// Helper to validate if a branch name follows version convention
export function isVersionBranch(branch: string): boolean {
  return branch === "main" || branch.startsWith("docs/")
}

// Get the URL for a specific version (project-aware)
export function getVersionUrl(
  versionKey: string,
  pathname: string = "/docs",
  projectId: ProjectId = "hive"
): string {
  const project = PROJECTS[projectId]
  const version = project.versions[versionKey]

  if (!version) {
    return `${PRODUCTION_URL}${pathname}`
  }

  // If it has an external URL, use that
  if ("externalUrl" in version && version.externalUrl) {
    return version.externalUrl
  }

  // Latest version uses production URL
  if (versionKey === "latest" || version.isDefault) {
    return `${PRODUCTION_URL}${pathname}`
  }

  // Other versions use Netlify branch deploys
  // Netlify converts branch names: docs/0.28.0 -> docs-0-28-0
  const branchSlug = version.branch.replace(/\//g, "-").replace(/\./g, "-")
  return `https://${branchSlug}--${NETLIFY_SITE_NAME}.netlify.app${pathname}`
}

// Get versions for a specific project
export function getProjectVersions(
  projectId: ProjectId
): Array<{ key: string } & VersionInfo> {
  const project = PROJECTS[projectId]
  return Object.entries(project.versions).map(([key, value]) => ({
    key,
    ...value,
  }))
}

// Check if a version has been migrated (branch exists)
export function isVersionMigrated(
  versionKey: string,
  projectId: ProjectId = "hive"
): boolean {
  const project = PROJECTS[projectId]

  // Latest is always available
  if (versionKey === "latest") return true

  // Legacy links externally, so it's "available"
  if (versionKey === "legacy") return true

  // For other versions, assume they exist if in the versions list
  return versionKey in project.versions
}
