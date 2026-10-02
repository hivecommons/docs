/**
 * Coverage for the docs root layout (src/app/docs/layout.tsx), previously
 * 0%: the site-wide `metadata` export (canonical, Open Graph, Twitter card,
 * robots, keywords) and the JSON-LD graph it embeds in <head>. Both are
 * what search engines index for docs.hivecommons.dev, so a typo in a URL or
 * a malformed JSON-LD entry ships silently without a test here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'

// globals.css goes through Next's Tailwind PostCSS plugin, which vite's CSS
// pipeline cannot load under vitest; the layout only needs the side-effect.
vi.mock('../app/globals.css', () => ({}))

// next/font/local reads woff2 files from disk at build time via SWC; under
// vitest it has no loader, so return the same shape ({ variable, className }).
vi.mock('next/font/local', () => ({
  default: (opts: { variable: string }) => ({
    variable: opts.variable,
    className: `${opts.variable}-class`,
  }),
}))

// The chrome components pull in client hooks and fetches that are covered by
// their own behavior tests; replace them so this test exercises only the
// layout's own output.
vi.mock('@/components/docs/index', () => ({
  DocsNavbar: () => <nav data-testid="navbar" />,
  DocsFooter: () => <footer data-testid="footer" />,
}))
vi.mock('@/components/docs/DocsProvider', () => ({
  DocsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/docs/MobileOverlay', () => ({
  MobileOverlay: () => <div data-testid="overlay" />,
}))
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

type JsonLdEntry = Record<string, unknown> & { '@context': string; '@type': string; name: string }

async function loadLayout() {
  return import('../app/docs/layout')
}

async function renderLayoutHtml(children: ReactNode = null): Promise<string> {
  const { default: DocsLayout } = await loadLayout()
  return renderToStaticMarkup(await DocsLayout({ children }))
}

function extractJsonLd(html: string): JsonLdEntry[] {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  expect(match, 'layout must embed exactly one ld+json script').not.toBeNull()
  return JSON.parse(match![1]) as JsonLdEntry[]
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('docs layout metadata', () => {
  it('anchors every absolute URL on the docs site origin', async () => {
    const { metadata } = await loadLayout()
    const base = metadata.metadataBase as URL
    expect(base).toBeInstanceOf(URL)
    expect(base.origin).toBe('https://docs.hivecommons.dev')

    const og = metadata.openGraph as { url: string; type: string; locale: string; siteName: string }
    expect(og.url).toBe(`${base.origin}/docs`)
    expect(og.type).toBe('website')
    expect(og.locale).toBe('en_US')
    expect(og.siteName).toBe('Hive Commons')

    expect(metadata.alternates?.canonical).toBe('/docs')
  })

  it('uses a title template so child pages get the site suffix', async () => {
    const { metadata } = await loadLayout()
    const title = metadata.title as { default: string; template: string }
    expect(title.template).toContain('%s')
    expect(title.template).toMatch(/Hive Commons Docs$/)
    expect(title.default.length).toBeGreaterThan(0)
    // OG and Twitter cards repeat the default title/description verbatim.
    const og = metadata.openGraph as { title: string; description: string }
    const tw = metadata.twitter as { title: string; description: string; card: string }
    expect(og.title).toBe(title.default)
    expect(tw.title).toBe(title.default)
    expect(og.description).toBe(metadata.description)
    expect(tw.description).toBe(metadata.description)
    expect(tw.card).toBe('summary_large_image')
  })

  it('shares a single OG image between Open Graph and Twitter with 1200x630 dimensions', async () => {
    const { metadata } = await loadLayout()
    const og = metadata.openGraph as { images: Array<{ url: string; width: number; height: number; alt: string }> }
    const tw = metadata.twitter as { images: string[] }
    expect(og.images).toHaveLength(1)
    expect(og.images[0]).toMatchObject({ url: '/hive-commons-og.png', width: 1200, height: 630 })
    expect(og.images[0].alt.length).toBeGreaterThan(0)
    expect(tw.images).toEqual([og.images[0].url])
  })

  it('allows indexing and lists integration and Spektacular keywords', async () => {
    const { metadata } = await loadLayout()
    expect(metadata.robots).toEqual({ index: true, follow: true })
    const keywords = metadata.keywords as string[]
    expect(Array.isArray(keywords)).toBe(true)
    expect(new Set(keywords).size).toBe(keywords.length)
    for (const k of ['Claude Code', 'GitHub Copilot CLI', 'vLLM', 'Spektacular', 'Spek', 'speks']) {
      expect(keywords).toContain(k)
    }
  })
})

describe('docs layout JSON-LD', () => {
  it('embeds a parseable schema.org graph with Hive, Spektacular and the Hive Commons org', async () => {
    const html = await renderLayoutHtml()
    const entries = extractJsonLd(html)
    expect(entries.map((e) => e['@type'])).toEqual([
      'SoftwareApplication',
      'SoftwareApplication',
      'Organization',
    ])
    expect(entries.map((e) => e.name)).toEqual(['Hive', 'Spektacular', 'Hive Commons'])
    for (const e of entries) {
      expect(e['@context']).toBe('https://schema.org')
      expect(String(e.url)).toMatch(/^https:\/\/([a-z]+\.)?hivecommons\.dev\/$|^https:\/\/spektacular\.dev\/$/)
    }
  })

  it('points both SoftwareApplication entries at Apache-2.0 and a hivecommons GitHub repo', async () => {
    const entries = extractJsonLd(await renderLayoutHtml())
    const apps = entries.filter((e) => e['@type'] === 'SoftwareApplication')
    expect(apps).toHaveLength(2)
    for (const app of apps) {
      expect(app.license).toBe('https://www.apache.org/licenses/LICENSE-2.0')
      expect(String(app.codeRepository)).toMatch(/^https:\/\/github\.com\/hivecommons\/[a-z-]+$/)
      expect(app.applicationCategory).toBe('DeveloperApplication')
      expect(app.operatingSystem).toBe('Linux, macOS')
      const features = app.featureList as string[]
      expect(features.length).toBeGreaterThan(0)
      expect(typeof app.keywords).toBe('string')
    }
    const spek = apps.find((a) => a.name === 'Spektacular')!
    expect(spek.alternateName).toBe('Spek')
  })

  it("keeps the Hive entry's keywords in sync with the page metadata keywords", async () => {
    const { metadata } = await loadLayout()
    const entries = extractJsonLd(await renderLayoutHtml())
    const hive = entries.find((e) => e.name === 'Hive')!
    const ldKeywords = String(hive.keywords).split(', ')
    expect(ldKeywords).toEqual(metadata.keywords)
  })

  it('lists the same infrastructure sponsors as both sponsor and funder, each with an https url', async () => {
    const entries = extractJsonLd(await renderLayoutHtml())
    const org = entries.find((e) => e['@type'] === 'Organization')!
    const sponsors = org.sponsor as Array<{ '@type': string; name: string; url: string }>
    expect(sponsors.length).toBeGreaterThan(0)
    expect(org.funder).toEqual(sponsors)
    for (const s of sponsors) {
      expect(s['@type']).toBe('Organization')
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.url).toMatch(/^https:\/\//)
    }
    expect(new Set(sponsors.map((s) => s.name)).size).toBe(sponsors.length)
  })

  it('serializes without a raw "</script>" that could break out of the ld+json block', async () => {
    const html = await renderLayoutHtml()
    const scripts = html.match(/<script type="application\/ld\+json">/g) ?? []
    expect(scripts).toHaveLength(1)
    const inner = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]
    expect(inner).not.toContain('</script')
  })
})

describe('docs layout shell', () => {
  it('renders an English <html> with the three self-hosted font variables on <body>', async () => {
    const html = await renderLayoutHtml(<main data-testid="child">page</main>)
    expect(html).toMatch(/^<html lang="en"/)
    const body = html.match(/<body class="([^"]+)"/)
    expect(body).not.toBeNull()
    for (const v of ['--font-inter', '--font-fraunces', '--font-jetbrains-mono', 'antialiased']) {
      expect(body![1]).toContain(v)
    }
  })

  it('places children between the navbar/overlay and the footer', async () => {
    const html = await renderLayoutHtml(<main data-testid="child">page</main>)
    const idx = (s: string) => html.indexOf(s)
    expect(idx('data-testid="navbar"')).toBeGreaterThan(-1)
    expect(idx('data-testid="navbar"')).toBeLessThan(idx('data-testid="overlay"'))
    expect(idx('data-testid="overlay"')).toBeLessThan(idx('data-testid="child"'))
    expect(idx('data-testid="child"')).toBeLessThan(idx('data-testid="footer"'))
  })
})
