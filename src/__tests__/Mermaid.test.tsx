import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// mermaid is mocked because @/lib/Mermaid calls mermaid.initialize() at module
// top level, and the real package reaches for browser globals on import.
// The mock functions are declared with vi.hoisted so they exist before the
// hoisted vi.mock factory runs, and the module under test is imported inside
// each test rather than statically: vitest 5 evaluates static imports before
// the mock is applied, which left initialize with zero recorded calls.
const { initializeMock, runMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  runMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    run: runMock,
  },
}))

describe('MermaidComponent', () => {
  it('returns null when children is an empty string', async () => {
    const { MermaidComponent } = await import('@/lib/Mermaid')
    const html = renderToStaticMarkup(
      createElement(MermaidComponent, { children: '' }),
    )
    expect(html).toBe('')
  })

  it('renders a mermaid div with the dark-mode invert classes when a chart is provided', async () => {
    const { MermaidComponent } = await import('@/lib/Mermaid')
    const html = renderToStaticMarkup(
      createElement(MermaidComponent, { children: 'graph TD; A-->B;' }),
    )
    expect(html).toContain('<div')
    expect(html).toContain('class="mermaid dark:invert dark:hue-rotate-180"')
    // Chart body is written imperatively in useEffect, not into the SSR markup.
    expect(html).not.toContain('graph TD')
  })

  it('calls mermaid.initialize with startOnLoad disabled on module load', async () => {
    // Earlier tests already imported the module, so its top-level side effect
    // has run and the module is cached. Reset the registry and the mock so this
    // test observes a fresh evaluation rather than a cached one.
    vi.resetModules()
    initializeMock.mockClear()
    await import('@/lib/Mermaid')
    expect(initializeMock).toHaveBeenCalledWith({
      startOnLoad: false,
      theme: 'default',
    })
  })
})
