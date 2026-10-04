/**
 * Remark plugin that removes every node through which MDX can run JavaScript.
 *
 * The docs pages compile markdown that is largely synced from other
 * repositories at build time, and `evaluate()` executes whatever the compiler
 * emits. HTML sanitization does not cover MDX's own JS surface, so this plugin
 * drops it from the syntax tree before compilation:
 *
 *   - `mdxjsEsm`            top-level `import` / `export` statements
 *   - `mdxFlowExpression`   `{expression}` on its own line
 *   - `mdxTextExpression`   `{expression}` inside a paragraph
 *   - JSX attribute expressions `<Tag prop={expression}>` and `{...spread}`
 *
 * It must run before nextra's own remark plugins (user `remarkPlugins` do),
 * since those add the `metadata` / `toc` ESM exports the layout relies on.
 *
 * Kept free of mdast/unist type imports: those packages are transitive
 * dependencies of nextra, and a structural subset is all that is needed.
 */

export const MDX_JS_NODE_TYPES = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression'])

export const MDX_JSX_NODE_TYPES = new Set(['mdxJsxFlowElement', 'mdxJsxTextElement'])

interface JsxAttributeLike {
  type: string
  value?: unknown
}

interface NodeLike {
  type: string
  children?: NodeLike[]
  attributes?: JsxAttributeLike[]
}

/** True for a JSX attribute whose value is JavaScript rather than a literal. */
function isJsAttribute(attr: JsxAttributeLike): boolean {
  if (attr.type === 'mdxJsxExpressionAttribute') return true
  const value = attr.value
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'mdxJsxAttributeValueExpression'
  )
}

/** Strips MDX JS nodes from `tree` in place and returns it. */
export function stripMdxJs<T extends NodeLike>(tree: T): T {
  if (MDX_JSX_NODE_TYPES.has(tree.type) && Array.isArray(tree.attributes)) {
    tree.attributes = tree.attributes.filter((attr) => !isJsAttribute(attr))
  }
  if (Array.isArray(tree.children)) {
    tree.children = tree.children.filter((child) => !MDX_JS_NODE_TYPES.has(child.type))
    for (const child of tree.children) stripMdxJs(child)
  }
  return tree
}

/** Remark plugin form of {@link stripMdxJs}. */
export function remarkStripMdxJs() {
  return (tree: NodeLike) => {
    stripMdxJs(tree)
  }
}
