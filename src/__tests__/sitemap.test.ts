import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import sitemap from '../app/sitemap'

const SITE_URL = 'https://docs.hivecommons.dev'

let fixtureRoot: string

function write(relPath: string, content = '# stub\n') {
  const full = path.join(fixtureRoot, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-fixture-'))

  // hive project content
  write('docs/content/hive/index.mdx')
  write('docs/content/hive/guides/setup.md')
  write('docs/content/hive/guides/advanced/scaling.mdx')
  // excluded: underscore-prefixed file and directory
  write('docs/content/hive/_partial.md')
  write('docs/content/hive/_drafts/wip.md')
  // excluded: hidden dir, node_modules, common-subs, images
  write('docs/content/hive/.hidden/secret.md')
  write('docs/content/hive/node_modules/pkg/readme.md')
  write('docs/content/hive/common-subs/shared.md')
  write('docs/content/hive/images/pic.md')
  // excluded: non-markdown file
  write('docs/content/hive/diagram.svg')

  // pluk project with an index file inside a subdirectory
  write('docs/content/pluk/cli/index.md')

  vi.spyOn(process, 'cwd').mockReturnValue(fixtureRoot)
})

afterAll(() => {
  vi.restoreAllMocks()
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('sitemap', () => {
  it('always includes homepage, locale marketing page, and docs landing page', () => {
    const entries = sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls).toContain(SITE_URL)
    expect(urls).toContain(`${SITE_URL}/en`)
    expect(urls).toContain(`${SITE_URL}/docs`)
  })

  it('assigns the documented priorities to each page tier', () => {
    const entries = sitemap()
    const byUrl = new Map(entries.map((e) => [e.url, e]))

    expect(byUrl.get(SITE_URL)?.priority).toBe(1.0)
    expect(byUrl.get(`${SITE_URL}/en`)?.priority).toBe(0.8)
    expect(byUrl.get(`${SITE_URL}/docs`)?.priority).toBe(0.9)
    expect(byUrl.get(`${SITE_URL}/docs/hive`)?.priority).toBe(0.9)
    expect(byUrl.get(`${SITE_URL}/docs/hive/guides/setup`)?.priority).toBe(0.7)
  })

  it('emits a project root entry for every project even without content', () => {
    const entries = sitemap()
    const urls = entries.map((e) => e.url)

    for (const base of ['hive', 'hotshot', 'pluk', 'rationguard', 'promptargs', 'dibs', 'spektacular']) {
      expect(urls).toContain(`${SITE_URL}/docs/${base}`)
    }
  })

  it('maps markdown files to routes, stripping extensions and /index suffixes', () => {
    const entries = sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls).toContain(`${SITE_URL}/docs/hive/guides/setup`)
    expect(urls).toContain(`${SITE_URL}/docs/hive/guides/advanced/scaling`)
    // cli/index.md collapses to the parent folder route
    expect(urls).toContain(`${SITE_URL}/docs/pluk/cli`)
    expect(urls).not.toContain(`${SITE_URL}/docs/pluk/cli/index`)
  })

  it('excludes underscore, hidden, node_modules, common-subs, images, and non-markdown entries', () => {
    const entries = sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls.some((u) => u.includes('_partial'))).toBe(false)
    expect(urls.some((u) => u.includes('_drafts'))).toBe(false)
    expect(urls.some((u) => u.includes('.hidden') || u.includes('secret'))).toBe(false)
    expect(urls.some((u) => u.includes('node_modules'))).toBe(false)
    expect(urls.some((u) => u.includes('common-subs') || u.includes('shared'))).toBe(false)
    expect(urls.some((u) => u.includes('/images/') || u.includes('pic'))).toBe(false)
    expect(urls.some((u) => u.includes('diagram'))).toBe(false)
  })

  it('uses file mtime as lastModified for docs pages', () => {
    const setupPath = path.join(fixtureRoot, 'docs/content/hive/guides/setup.md')
    const mtime = fs.statSync(setupPath).mtime

    const entries = sitemap()
    const entry = entries.find((e) => e.url === `${SITE_URL}/docs/hive/guides/setup`)

    expect(entry?.lastModified).toEqual(mtime)
  })

  it('marks docs pages weekly and marketing pages monthly', () => {
    const entries = sitemap()
    const byUrl = new Map(entries.map((e) => [e.url, e]))

    expect(byUrl.get(SITE_URL)?.changeFrequency).toBe('monthly')
    expect(byUrl.get(`${SITE_URL}/en`)?.changeFrequency).toBe('monthly')
    expect(byUrl.get(`${SITE_URL}/docs`)?.changeFrequency).toBe('weekly')
    expect(byUrl.get(`${SITE_URL}/docs/hive/guides/setup`)?.changeFrequency).toBe('weekly')
  })

  it('returns no docs-page entries when the content root is missing', () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-empty-'))
    const spy = vi.spyOn(process, 'cwd').mockReturnValue(emptyRoot)
    try {
      const entries = sitemap()
      // homepage + /en + /docs + 7 project roots, nothing else
      expect(entries).toHaveLength(10)
    } finally {
      spy.mockReturnValue(fixtureRoot)
      fs.rmSync(emptyRoot, { recursive: true, force: true })
    }
  })
})
