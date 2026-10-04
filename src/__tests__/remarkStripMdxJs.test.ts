import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { compileMdx } from 'nextra/compile'
import { evaluate } from 'nextra/evaluate'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { remarkStripMdxJs, stripMdxJs, MDX_JS_NODE_TYPES } from '@/lib/remarkStripMdxJs'

// Same shim as docs-page-render.test.ts: under vitest NODE_ENV is "test", so
// nextra's evaluate() injects the dev JSX runtime while compileMdx emits
// production _jsx() calls. Re-implement the runtime injection with the
// production runtime; compile and evaluation of the content stay real.
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

type Probe = typeof globalThis & { __mdxProbe?: string[] }
const g = globalThis as Probe

async function compileAndRender(markdown: string, remarkPlugins: unknown[]): Promise<string> {
  const compiled = await compileMdx(markdown, {
    mdxOptions: { remarkPlugins: remarkPlugins as never, rehypePlugins: [] },
  })
  const evaluated = evaluate(compiled, {})
  return renderToStaticMarkup(createElement(evaluated.default))
}

const record = (tag: string) => `(globalThis.__mdxProbe ??= []).push(${JSON.stringify(tag)})`

const ESM = `# Title\n\nexport const leak = (() => { ${record('esm')}; return 1 })()\n\nBody text.\n`
const FLOW_EXPRESSION = `# Title\n\n{(() => { ${record('flow')}; return 'x' })()}\n\nBody text.\n`
const TEXT_EXPRESSION = `# Title\n\nBefore {(() => { ${record('text')}; return 'x' })()} after.\n`
const ATTRIBUTE_EXPRESSION = `# Title\n\n<div title={(() => { ${record('attr')}; return 'x' })()}>inner</div>\n`
const SPREAD_ATTRIBUTE = `# Title\n\n<div {...(() => { ${record('spread')}; return { id: 'x' } })()}>inner</div>\n`

describe('remarkStripMdxJs', () => {
  // The first compileMdx call loads the MDX toolchain; keep that cost out of
  // the per-test timeout.
  beforeAll(async () => {
    await compileMdx('# warm up', { mdxOptions: { remarkPlugins: [], rehypePlugins: [] } })
  }, 30_000)

  beforeEach(() => {
    delete g.__mdxProbe
  })
  afterEach(() => {
    delete g.__mdxProbe
  })

  it('without the plugin, content JavaScript executes (the hazard being closed)', async () => {
    await compileAndRender(ESM, [])
    expect(g.__mdxProbe).toEqual(['esm'])
  })

  it.each([
    ['top-level ESM', ESM],
    ['flow expression', FLOW_EXPRESSION],
    ['text expression', TEXT_EXPRESSION],
    ['JSX attribute expression', ATTRIBUTE_EXPRESSION],
    ['JSX spread attribute', SPREAD_ATTRIBUTE],
  ])('neutralizes %s', async (_label, markdown) => {
    const html = await compileAndRender(markdown, [remarkStripMdxJs])
    expect(g.__mdxProbe).toBeUndefined()
    expect(html).toContain('Title')
  })

  it('keeps literal JSX attributes and surrounding content', async () => {
    const html = await compileAndRender(ATTRIBUTE_EXPRESSION.replace(/title=\{[\s\S]*?\}>/, 'title="plain">'), [
      remarkStripMdxJs,
    ])
    expect(html).toContain('title="plain"')
    expect(html).toContain('inner')
  })

  it("preserves nextra's generated metadata and toc exports", async () => {
    const compiled = await compileMdx(`# Heading One\n\n## Heading Two\n\n${ESM}`, {
      mdxOptions: { remarkPlugins: [remarkStripMdxJs] as never, rehypePlugins: [] },
    })
    const evaluated = evaluate(compiled, {})
    expect(evaluated.toc.map((entry) => entry.value)).toContain('Heading Two')
    expect(evaluated.metadata).toBeDefined()
    expect(g.__mdxProbe).toBeUndefined()
  })

  it('leaves code fences containing import/export lines as code', async () => {
    const md = '# Title\n\n```ts\nimport { x } from "y"\nexport const z = 1\n```\n'
    const html = await compileAndRender(md, [remarkStripMdxJs])
    expect(html).toContain('import')
    expect(html).toContain('export')
  })

  it('stripMdxJs removes JS nodes recursively and tolerates nodes without children', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'mdxjsEsm' },
        {
          type: 'paragraph',
          children: [{ type: 'text' }, { type: 'mdxTextExpression' }],
        },
        {
          type: 'mdxJsxFlowElement',
          attributes: [
            { type: 'mdxJsxAttribute', value: 'literal' },
            { type: 'mdxJsxAttribute', value: null },
            { type: 'mdxJsxAttribute', value: { type: 'mdxJsxAttributeValueExpression' } },
            { type: 'mdxJsxExpressionAttribute' },
          ],
          children: [{ type: 'mdxFlowExpression' }],
        },
      ],
    }
    const out = stripMdxJs(tree)
    expect(out.children.map((c) => c.type)).toEqual(['paragraph', 'mdxJsxFlowElement'])
    expect(out.children[0].children?.map((c) => c.type)).toEqual(['text'])
    expect(out.children[1].attributes?.map((a) => a.type)).toEqual(['mdxJsxAttribute', 'mdxJsxAttribute'])
    expect(out.children[1].children).toEqual([])
    for (const type of MDX_JS_NODE_TYPES) expect(JSON.stringify(out)).not.toContain(type)
  })
})
