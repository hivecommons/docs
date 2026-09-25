import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('next-intl/middleware', () => ({
  default: () => (request: NextRequest) => {
    const url = request.nextUrl.clone()
    if (!url.pathname.match(/^\/(en|hi|ja|es|de|fr|it|SC|zh-TW|pt)(?:\/|$)/)) {
      url.pathname = `/en${url.pathname}`
    }
    return NextResponse.rewrite(url)
  },
}))

const { config, proxy } = await import('../proxy')

function request(pathname: string) {
  return new NextRequest(new URL(pathname, 'https://docs.hivecommons.dev'))
}

describe('proxy', () => {
  it('redirects the site root to the docs landing page without permanent caching', () => {
    const response = proxy(request('/'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://docs.hivecommons.dev/docs')
  })

  it('redirects localized docs paths to canonical unlocalized docs paths', () => {
    const response = proxy(request('/es/docs/architecture?tab=install'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://docs.hivecommons.dev/docs/architecture?tab=install')
  })

  it('redirects exact localized docs landing paths to the canonical docs landing path', () => {
    const response = proxy(request('/en/docs'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://docs.hivecommons.dev/docs')
  })

  it('handles uppercase and region locales when canonicalizing docs paths', () => {
    expect(proxy(request('/SC/docs/readme')).headers.get('location')).toBe('https://docs.hivecommons.dev/docs/readme')
    expect(proxy(request('/zh-TW/docs/readme')).headers.get('location')).toBe('https://docs.hivecommons.dev/docs/readme')
  })


  it('redirects region-qualified docs locales to canonical docs paths', () => {
    const response = proxy(request('/pt-BR/docs/hive/setup'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://docs.hivecommons.dev/docs/hive/setup')
  })

  it('does not treat three-letter prefixes as localized docs URLs', () => {
    const response = proxy(request('/abc/docs/page'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://docs.hivecommons.dev/en/abc/docs/page')
    expect(response.headers.get('location')).toBeNull()
  })

  it('keeps non-doc localized pages in the i18n middleware flow', () => {
    const response = proxy(request('/es/community'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://docs.hivecommons.dev/es/community')
    expect(response.headers.get('location')).toBeNull()
  })

  it('rewrites unlocalized pages through the default locale middleware', () => {
    const response = proxy(request('/community'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://docs.hivecommons.dev/en/community')
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not run on canonical docs, API, Next.js asset, or file-extension paths', () => {
    expect(config.matcher).toEqual([
      '/((?!docs|api|_next|_vercel|code|.*\\..*).*)',
      '/',
    ])
  })
})
