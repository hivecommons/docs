import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const notFound = fs.readFileSync(path.join(process.cwd(), 'src/components/NotFoundUI.tsx'), 'utf8')
const errorFallback = fs.readFileSync(path.join(process.cwd(), 'src/components/ErrorFallbackUI.tsx'), 'utf8')

describe('Hive Commons 404 and error copy', () => {
  it('uses Hive Commons themed 404 copy and Hive-specific docs links', () => {
    expect(notFound).toContain('This page may have moved while we reorganized the Hive docs')
    expect(notFound).toContain('/docs/hive/readme')
    expect(notFound).toContain('/docs/hive/getting-started')
    expect(notFound).toContain('/docs/hive/documentation-map')
    expect(notFound).toContain('/docs/community/meetings')
    expect(notFound).toContain('Search the docs')
    expect(notFound).not.toMatch(/KubeStellar|Console theme|Kubernetes dashboard|multi-cluster management/i)
  })

  it('uses Hive Commons themed runtime error copy', () => {
    expect(errorFallback).toContain('Hive Commons Docs')
    expect(errorFallback).toContain('The docs hit a temporary runtime error')
    expect(errorFallback).toContain('/docs/hive/readme')
    expect(errorFallback).not.toMatch(/KubeStellar|Console theme|Kubernetes dashboard|multi-cluster management/i)
  })
})
