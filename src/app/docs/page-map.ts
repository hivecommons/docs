import { normalizePageMap } from 'nextra/page-map'
import fs from 'fs'
import path from 'path'
import { type ProjectId } from '@/config/versions'

// Local docs path - docs are now in this repository
export const docsContentPath = path.join(process.cwd(), 'docs', 'content')
export const basePath = 'docs'

// Get content path for a project
export function getContentPath(projectId: ProjectId): string {
  switch (projectId) {
    case 'hotshot':
      return path.join(process.cwd(), 'docs', 'content', 'hotshot')
    case 'pluk':
      return path.join(process.cwd(), 'docs', 'content', 'pluk')
    case 'rationguard':
      return path.join(process.cwd(), 'docs', 'content', 'rationguard')
    case 'promptargs':
      return path.join(process.cwd(), 'docs', 'content', 'promptargs')
    case 'hive':
    default:
      return path.join(process.cwd(), 'docs', 'content', 'hive')
  }
}

// Get base path for a project
export function getBasePath(projectId: ProjectId): string {
  switch (projectId) {
    case 'hotshot':
      return 'docs/hotshot'
    case 'pluk':
      return 'docs/pluk'
    case 'rationguard':
      return 'docs/rationguard'
    case 'promptargs':
      return 'docs/promptargs'
    case 'hive':
    default:
      return 'docs/hive'
  }
}

// Strong types for page-map nodes
type MdxPageNode = { kind: 'MdxPage'; name: string; route: string }
type FolderNode = { kind: 'Folder'; name: string; route: string; children: PageMapNode[]; theme?: { collapsed?: boolean } }
type MetaNode = { kind: 'Meta'; data: Record<string, string> }
type PageMapNode = MdxPageNode | FolderNode | MetaNode

// Helper to prettify names
const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

// Recursively get all markdown files from the local docs directory
function getAllDocFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(baseDir, fullPath)

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getAllDocFiles(fullPath, baseDir))
      }
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      // Normalize to forward slashes for cross-platform consistency
      files.push(relativePath.replace(/\\/g, '/'))
    }
  }

  return files
}

// Navigation structure based on mkdocs.yml
type NavItem = { [key: string]: string | NavItem[] | NavItem } | string

const NAV_STRUCTURE_HIVE: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
      { 'Architecture': 'architecture.md' },
    ]
  },
  {
    title: 'Operations',
    items: [
      { 'Agent Definition YAML': 'agent-definition-yaml.md' },
      { 'Variable Substitution': 'variable-substitution.md' },
      { 'Governor': 'governor.md' },
      { 'Running on macOS': 'macos.md' },
    ]
  }
]

// hotshot Navigation Structure
const NAV_STRUCTURE_HOTSHOT: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  },
  {
    title: 'Platforms',
    items: [
      { 'Linux': 'linux.md' },
      { 'Windows': 'windows.md' },
    ]
  }
]

// pluk Navigation Structure
const NAV_STRUCTURE_PLUK: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  }
]

// rationguard Navigation Structure
const NAV_STRUCTURE_RATIONGUARD: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  }
]

// promptargs Navigation Structure
const NAV_STRUCTURE_PROMPTARGS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  }
]

// Get navigation structure for a project
function getNavStructure(projectId: ProjectId): Array<{ title: string; items: NavItem[] }> {
  switch (projectId) {
    case 'hotshot':
      return NAV_STRUCTURE_HOTSHOT
    case 'pluk':
      return NAV_STRUCTURE_PLUK
    case 'rationguard':
      return NAV_STRUCTURE_RATIONGUARD
    case 'promptargs':
      return NAV_STRUCTURE_PROMPTARGS
    case 'hive':
    default:
      return NAV_STRUCTURE_HIVE
  }
}

export function buildPageMap(projectId: ProjectId = 'hive') {
  const contentPath = getContentPath(projectId)
  const projectBasePath = getBasePath(projectId)
  const navStructure = getNavStructure(projectId)

  const allDocFiles = getAllDocFiles(contentPath)
  const processedFiles = new Set<string>()
  const routeMap: Record<string, string> = {}
  const _pageMap: PageMapNode[] = []

  function buildNavNodes(items: NavItem[], parentSlug: string): PageMapNode[] {
    const nodes: PageMapNode[] = []
    const meta: Record<string, string> = {}

    for (const item of items) {
      if (typeof item === 'string') {
        // Simple file reference
        if (allDocFiles.includes(item)) {
          processedFiles.add(item)
          const baseName = item.replace(/\.(md|mdx)$/i, '').split('/').pop()!
          // Use /docs path for general sections, project path for everything else
          const isGeneralSection = item.startsWith('contributing/') || item.startsWith('community/') || item.startsWith('news/')
          const basePathForRoute = isGeneralSection ? 'docs' : projectBasePath
          const route = `/${basePathForRoute}/${parentSlug}/${baseName}`
          routeMap[`${parentSlug}/${baseName}`] = item
          nodes.push({ kind: 'MdxPage', name: pretty(baseName), route })
          meta[pretty(baseName)] = pretty(baseName)
        }
      } else {
        // Object with title: path or title: children
        const title = Object.keys(item)[0]
        const value = (item as Record<string, string | NavItem[]>)[title]

        if (typeof value === 'string') {
          // It's a file path or link
          if (value.startsWith('http') || value.startsWith('/')) {
            // External link or absolute internal link
            nodes.push({ kind: 'MdxPage', name: title, route: value })
            meta[title] = title
          } else if (allDocFiles.includes(value)) {
            processedFiles.add(value)
            // const baseName = value.replace(/\.(md|mdx)$/i, '').split('/').pop()!
            const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            // Use /docs path for general sections, project path for everything else
            const isGeneralSection = value.startsWith('contributing/') || value.startsWith('community/') || value.startsWith('news/')
            const basePathForRoute = isGeneralSection ? 'docs' : projectBasePath
            const route = `/${basePathForRoute}/${parentSlug ? parentSlug + '/' : ''}${slug}`
            routeMap[`${parentSlug ? parentSlug + '/' : ''}${slug}`] = value
            nodes.push({ kind: 'MdxPage', name: title, route })
            meta[title] = title
          }
        } else if (Array.isArray(value)) {
          // It's a folder with children
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          const newParentSlug = parentSlug ? `${parentSlug}/${slug}` : slug
          const children = buildNavNodes(value, newParentSlug)
          if (children.length > 0) {
            // Use /docs path for general sections, project path for everything else
            // Check both direct string entries and nested values in objects
            const isGeneralSection = Array.isArray(value) &&
              value.some(v => {
                if (typeof v === 'string') {
                  return v.startsWith('contributing/') || v.startsWith('community/') || v.startsWith('news/')
                }
                // For object entries, check if any value starts with general section path
                if (typeof v === 'object' && v !== null) {
                  const objValues = Object.values(v);
                  return objValues.some(val =>
                    typeof val === 'string' &&
                    (val.startsWith('contributing/') || val.startsWith('community/') || val.startsWith('news/'))
                  );
                }
                return false;
              })
            const basePathForRoute = isGeneralSection ? 'docs' : projectBasePath
            nodes.push({
              kind: 'Folder',
              name: title,
              route: `/${basePathForRoute}/${newParentSlug}`,
              children
            })
            meta[title] = title
          }
        }
      }
    }

    if (Object.keys(meta).length > 0) {
      nodes.unshift({ kind: 'Meta', data: meta })
    }

    return nodes
  }

  // Build navigation from navStructure (project-specific)
  for (const category of navStructure) {
    const categorySlug = category.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const children = buildNavNodes(category.items, categorySlug)

    if (children.length > 0) {
      // Use /docs path for general sections, project path for project-specific sections
      const isGeneralSection = ['Contributing', 'Community', 'News'].includes(category.title)
      const basePath = isGeneralSection ? 'docs' : projectBasePath

      const folderNode: FolderNode = {
        kind: 'Folder',
        name: category.title,
        route: `/${basePath}/${categorySlug}`,
        children
      }

      // Set theme for first category to be expanded
      if (category.title === 'Welcome' || category.title === 'Overview') {
        folderNode.theme = { collapsed: false }
      }

      _pageMap.push(folderNode)
    }
  }

  // Add top-level meta - only include our defined navigation structure
  const meta: Record<string, string> = {}
  for (const category of navStructure) {
    meta[category.title] = category.title
  }
  _pageMap.unshift({ kind: 'Meta', data: meta })

  // Populate routeMap with all files for fallback resolution (needed for link rewriting)
  for (const fp of allDocFiles) {
    const noExt = fp.replace(/\.(md|mdx)$/i, '')
    if (!routeMap[noExt]) {
      routeMap[noExt] = fp
    }
  }

  const pageMap = normalizePageMap(_pageMap)

  return { pageMap, routeMap, filePaths: allDocFiles, contentPath }
}

// For backwards compatibility, export a function that doesn't need branch parameter
export async function buildPageMapForBranch() {
  return buildPageMap()
}
