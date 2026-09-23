/**
 * Render check for the synced Spektacular pages.
 *
 * Two of these pages are converted from Astro MDX by
 * scripts/mdx-to-markdown.ts. If the converter leaves anything behind that the
 * site's MDX compiler rejects (a JSX tag, an import, a stray brace), the page
 * silently degrades to the `<pre>` plain-text fallback in
 * src/app/docs/[...slug]/page.tsx. This test renders every Spektacular route
 * end-to-end and fails on that fallback, so the sync output stays renderable.
 *
 * The mocks mirror src/__tests__/docs-page-render.test.ts; see there for why.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('nextra/evaluate', async () => {
  const runtime = await import('react/jsx-runtime')
  return {
    evaluate(rawJs: string, components = {}, scope: Record<string, unknown> = {}) {
      const keys = Object.keys(scope)
      const values = Object.values(scope)
      const hydrateFn = Reflect.construct(Function, ['$', ...keys, rawJs])
      return hydrateFn({ ...runtime, useMDXComponents: () => components }, ...values)
    },
  }
})

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>()
  return {
    ...actual,
    usePathname: () => '/docs/spektacular/overview/introduction',
  }
})

vi.mock('next/link', async () => {
  const { createElement: h } = await import('react')
  return {
    default: ({
      href,
      children,
      ...rest
    }: { href?: unknown; children?: ReactNode } & Record<string, unknown>) =>
      h('a', { ...rest, href: typeof href === 'string' ? href : undefined }, children),
  }
})

import { DocsProvider } from '../components/docs/DocsProvider'
import DocPage from '../app/docs/[...slug]/page'

async function renderDocsRoute(slug: string[]): Promise<string> {
  const page = await DocPage({ params: Promise.resolve({ slug }) })
  return renderToStaticMarkup(createElement(DocsProvider, null, page))
}

const RENDER_TIMEOUT_MS = 60_000

// Route -> the H1 the synced page must render with.
const SPEKTACULAR_PAGES: Array<{ slug: string[]; h1: string }> = [
  { slug: ['spektacular', 'overview', 'introduction'], h1: 'Spektacular' },
  { slug: ['spektacular', 'tutorials', 'getting-started'], h1: 'How to use Spektacular' },
  { slug: ['spektacular', 'tutorials', 'unknown-criteria'], h1: 'Dealing with unknown criteria' },
  { slug: ['spektacular', 'guides', 'knowledge-base'], h1: 'The Knowledge Base' },
]

describe('Spektacular synced pages render', () => {
  for (const { slug, h1 } of SPEKTACULAR_PAGES) {
    it(
      `/docs/${slug.join('/')} compiles and renders its heading`,
      async () => {
        const html = await renderDocsRoute(slug)
        expect(html).toMatch(/<article[^>]+class="[^"]*\bprose\b[^"]*"/)
        // The plain-text fallback wraps the whole source in a single <pre>
        // that starts with the synced-from blockquote marker.
        expect(html).not.toMatch(/<pre>&gt; \*\*Synced from/)
        expect(html).toMatch(new RegExp(`<h1[^>]*>[^<]*${h1}`))
        expect(html).toMatch(/<h2[^>]*>/)
        expect(html).toContain('spektacular.dev')
      },
      RENDER_TIMEOUT_MS
    )
  }

  it(
    'serves tutorial screenshots through the docs-image route',
    async () => {
      const html = await renderDocsRoute(['spektacular', 'tutorials', 'getting-started'])
      expect(html).toMatch(/src="\/docs-images\/spektacular\/images\/tutorials\/getting-started\/[a-z-]+\.png"/)
      // Watch-on-YouTube links replace the site's embedded player.
      expect(html).toContain('https://youtu.be/ZRVa9gml_Bg?t=108')
    },
    RENDER_TIMEOUT_MS
  )
})
