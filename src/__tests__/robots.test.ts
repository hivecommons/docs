import { describe, expect, it } from 'vitest'

import robots from '../app/robots'

describe('robots', () => {
  it('allows all user agents on the whole site', () => {
    const result = robots()

    expect(result.rules).toEqual({ userAgent: '*', allow: '/' })
  })

  it('points crawlers at the canonical sitemap URL', () => {
    expect(robots().sitemap).toBe('https://docs.hivecommons.dev/sitemap.xml')
  })
})
