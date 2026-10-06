import { describe, expect, it, vi } from 'vitest'
import type { spawnSync } from 'node:child_process'
import { isSyncOptional, runSyncStep } from './run-sync-step'

const fake = (status: number | null) =>
  vi.fn(() => ({ status })) as unknown as typeof spawnSync

describe('run-sync-step', () => {
  it('is strict unless DOCS_SYNC_OPTIONAL=1', () => {
    expect(isSyncOptional({})).toBe(false)
    expect(isSyncOptional({ DOCS_SYNC_OPTIONAL: '0' })).toBe(false)
    expect(isSyncOptional({ DOCS_SYNC_OPTIONAL: '1' })).toBe(true)
  })

  it('passes through success', () => {
    expect(runSyncStep('a.ts', {}, fake(0))).toBe(0)
  })

  it('propagates failure by default', () => {
    expect(runSyncStep('a.ts', {}, fake(1))).toBe(1)
    expect(runSyncStep('a.ts', {}, fake(null))).toBe(1)
  })

  it('tolerates failure when opted in', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(runSyncStep('a.ts', { DOCS_SYNC_OPTIONAL: '1' }, fake(1))).toBe(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
