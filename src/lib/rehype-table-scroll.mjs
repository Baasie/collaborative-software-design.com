/** A wide table scrolls on its own, and the page does not.
 *
 * An article can carry a three-column table of sentences. On a phone that is
 * wider than the screen, and a table that overflows drags the whole page
 * sideways with it. `display: block` on the table would contain it, and would
 * also strip its table semantics in Chrome, so a screen reader stops hearing
 * rows and columns. So the table is left alone and wrapped instead.
 *
 * The wrapper is a focusable, labelled region because a scrolling area a
 * keyboard cannot reach is one a keyboard user cannot read (axe:
 * `scrollable-region-focusable`).
 */
export function rehypeTableScroll() {
  return (tree) => {
    const walk = (node) => {
      const kids = node.children ?? [];
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        if (k.type === 'element' && k.tagName === 'table') {
          kids[i] = {
            type: 'element', tagName: 'div',
            properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Table' },
            children: [k],
          };
        } else {
          walk(k);
        }
      }
    };
    walk(tree);
  };
}
