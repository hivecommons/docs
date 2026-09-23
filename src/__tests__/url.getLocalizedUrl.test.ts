import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for getLocalizedUrl() and the server-side production fallback of
 * getBaseUrl(). Complements url.test.ts, which covers the client-side
 * hostname validation of getBaseUrl().
 */

const originalWindow = globalThis.window

function mockWindow(host: string, protocol = 'https:') {
  Object.defineProperty(globalThis, 'window', {
    value: { location: { host, protocol } },
    writable: true,
    configurable: true,
  })
}

function restoreWindow() {
  if (originalWindow === undefined) {
    // @ts-expect-error - removing window for SSR tests
    delete globalThis.window
  } else {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    })
  }
}

async function importFresh() {
  vi.resetModules()
  return await import('../lib/url')
}

afterEach(() => {
  restoreWindow()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getBaseUrl — server-side production fallback', () => {
  beforeEach(() => {
    restoreWindow()
  })

  it('falls back to the production URL when not in development and no base URL is set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '')
    const mod = await importFresh()
    expect(mod.getBaseUrl()).toBe('https://docs.hivecommons.dev')
  })
})

describe('getLocalizedUrl', () => {
  it('returns relative URLs unchanged', async () => {
    const mod = await importFresh()
    expect(mod.getLocalizedUrl('/docs/architecture')).toBe('/docs/architecture')
    expect(mod.getLocalizedUrl('docs/architecture')).toBe('docs/architecture')
    expect(mod.getLocalizedUrl('#anchor')).toBe('#anchor')
    expect(mod.getLocalizedUrl('')).toBe('')
  })

  it('returns external absolute URLs unchanged', async () => {
    const mod = await importFresh()
    expect(mod.getLocalizedUrl('https://example.com/docs')).toBe('https://example.com/docs')
    expect(mod.getLocalizedUrl('http://github.com/hivecommons/hive')).toBe(
      'http://github.com/hivecommons/hive'
    )
  })

  it('does not rewrite lookalike hostnames', async () => {
    const mod = await importFresh()
    const evil = 'https://docs.hivecommons.dev.evil.com/docs'
    expect(mod.getLocalizedUrl(evil)).toBe(evil)
  })

  it('rewrites docs.hivecommons.dev URLs to the current base on a preview host', async () => {
    mockWindow('deploy-preview-7--hivecommons-docs.netlify.app', 'https:')
    const mod = await importFresh()
    expect(mod.getLocalizedUrl('https://docs.hivecommons.dev/docs/architecture')).toBe(
      'https://deploy-preview-7--hivecommons-docs.netlify.app/docs/architecture'
    )
  })

  it('preserves query string and hash when rewriting', async () => {
    mockWindow('localhost:3000', 'http:')
    const mod = await importFresh()
    expect(
      mod.getLocalizedUrl('https://docs.hivecommons.dev/docs?version=latest#install')
    ).toBe('http://localhost:3000/docs?version=latest#install')
  })

  it('returns the original string when URL parsing fails', async () => {
    const mod = await importFresh()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Starts with http:// so it is not treated as relative, but is unparseable.
    const malformed = 'http://'
    expect(mod.getLocalizedUrl(malformed)).toBe(malformed)
    expect(errSpy).toHaveBeenCalled()
  })
})
