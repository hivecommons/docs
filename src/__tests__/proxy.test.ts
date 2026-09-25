import { beforeEach, describe, expect, it, vi } from 'vitest'

const intlHandler = vi.fn(() => 'intl-result')

vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => intlHandler),
}))

const redirect = vi.fn((url: { pathname: string }, status: number) => ({
  kind: 'redirect',
  pathname: url.pathname,
  status,
}))

vi.mock('next/server', () => ({
  NextResponse: { redirect },
  NextRequest: class {},
}))

const { proxy, config } = await import('../proxy')

type FakeUrl = { pathname: string; clone: () => FakeUrl }

function makeRequest(pathname: string) {
  const url: FakeUrl = {
    pathname,
    clone() {
      return makeRequest(this.pathname).nextUrl
    },
  }
  return { nextUrl: url } as never
}

beforeEach(() => {
  redirect.mockClear()
  intlHandler.mockClear()
})

describe('proxy', () => {
  it('redirects two-letter locale docs URLs to the non-localized path with 307', () => {
    const result = proxy(makeRequest('/es/docs/getting-started')) as {
      pathname: string
      status: number
    }

    expect(redirect).toHaveBeenCalledTimes(1)
    expect(result.pathname).toBe('/docs/getting-started')
    expect(result.status).toBe(307)
  })

  it('redirects region-qualified locales like /pt-BR/docs/*', () => {
    const result = proxy(makeRequest('/pt-BR/docs/hive/setup')) as { pathname: string }

    expect(result.pathname).toBe('/docs/hive/setup')
  })

  it('redirects the /SC/docs/* pseudo-locale', () => {
    const result = proxy(makeRequest('/SC/docs/hive')) as { pathname: string }

    expect(result.pathname).toBe('/docs/hive')
  })

  it('redirects the root path to /docs with 307', () => {
    const result = proxy(makeRequest('/')) as { pathname: string; status: number }

    expect(result.pathname).toBe('/docs')
    expect(result.status).toBe(307)
  })

  it('delegates non-docs, non-root paths to the i18n middleware', () => {
    const request = makeRequest('/en/community')
    const result = proxy(request)

    expect(result).toBe('intl-result')
    expect(intlHandler).toHaveBeenCalledWith(request)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('does not treat non-locale prefixes as localized docs URLs', () => {
    // three-letter prefix does not match the locale pattern
    const result = proxy(makeRequest('/abc/docs/page'))

    expect(result).toBe('intl-result')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('exports a matcher config that excludes docs, api, and static assets', () => {
    expect(config.matcher).toContain('/')
    expect(config.matcher.some((m: string) => m.includes('?!docs|api'))).toBe(true)
  })
})
