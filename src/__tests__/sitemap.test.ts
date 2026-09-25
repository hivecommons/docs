import { describe, expect, it } from 'vitest'
import sitemap from '../app/sitemap'

const SITE_URL = 'https://docs.hivecommons.dev'

describe('sitemap', () => {
  it('uses absolute production URLs for marketing and docs landing routes', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toContain(SITE_URL)
    expect(urls).toContain(`${SITE_URL}/en`)
    expect(urls).toContain(`${SITE_URL}/docs`)
    expect(urls.every((url) => url.startsWith(`${SITE_URL}/` ) || url === SITE_URL)).toBe(true)
  })

  it('includes project roots and markdown-backed docs routes', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toEqual(expect.arrayContaining([
      `${SITE_URL}/docs/hive`,
      `${SITE_URL}/docs/hive/architecture`,
      `${SITE_URL}/docs/hive/adr/0001-record-architecture-decisions`,
      `${SITE_URL}/docs/hotshot`,
      `${SITE_URL}/docs/hotshot/windows`,
      `${SITE_URL}/docs/pluk`,
      `${SITE_URL}/docs/rationguard`,
      `${SITE_URL}/docs/promptargs`,
      `${SITE_URL}/docs/dibs`,
      `${SITE_URL}/docs/spektacular`,
      `${SITE_URL}/docs/spektacular/getting-started`,
    ]))
  })

  it('does not include shared partials or image assets as docs pages', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).not.toContain(`${SITE_URL}/docs/common-subs/coming-soon`)
    expect(urls.some((url) => url.includes('/common-subs/'))).toBe(false)
    expect(urls.some((url) => url.includes('/images/'))).toBe(false)
  })
})
