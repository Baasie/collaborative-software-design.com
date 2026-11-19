/** A link to the book in a body carries the affiliate parameters.
 *
 * Somebody writing in Notion pastes the book's address from their browser, and
 * that address has no `a_aid`. Twice already that cost the credit on every
 * sale a page sent (see "the Manning link keeps its affiliate parameters" in
 * tests/build.test.mjs). The test caught it, and catching it meant failing the
 * deploy over somebody's writing, which AGENTS.md says a deploy must never do.
 * So the build now repairs it: any link to the book's page that lacks the
 * affiliate id is pointed at the affiliate URL instead. The test stays, as the
 * proof that this keeps working.
 *
 * Only the book's own page. A link to a Manning chapter, a liveBook page or
 * another title is left exactly as written.
 */
const BOOK_PAGE = /^https?:\/\/(www\.)?manning\.com\/books\/collaborative-software-design\/?(\?[^#]*)?(#.*)?$/;

export function rehypeBookLink({ url }) {
  return () => (tree) => {
    const walk = (node) => {
      if (node.type === 'element' && node.tagName === 'a') {
        const href = String(node.properties?.href ?? '');
        if (BOOK_PAGE.test(href) && !href.includes('a_aid=')) node.properties.href = url;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
