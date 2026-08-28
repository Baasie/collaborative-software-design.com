/** No image in a body reaches a screen reader as a file name.
 *
 * The converter writes a Notion image as `![caption](file)`, so an image with
 * no caption becomes `![](file)`. The alt IS in the markdown tree, as an empty
 * string, and Astro's image transform then drops the attribute on the way to
 * the page rather than writing `alt=""`. An `<img>` with no `alt` at all is
 * the one case a screen reader has to guess at, and what it guesses is the
 * file name: "navigating power dynamics in software decision making body 1
 * denL1AGZ Z4eb8l dot webp".
 *
 * So an image with an empty alt is marked presentational, which survives the
 * transform and says "skip this" as `alt=""` would have.
 *
 * This is a floor, not a fix, and it is worth saying which images are on it:
 * the diagrams from the book are NOT decoration. An image that carries meaning
 * needs a caption in Notion, and the caption becomes its alt text.
 */
export function rehypeEmptyAlt() {
  return (tree) => {
    const walk = (node) => {
      if (node.type === 'element' && node.tagName === 'img') {
        const props = node.properties ?? {};
        if (!props.alt) node.properties = { ...props, alt: '', role: 'presentation' };
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
