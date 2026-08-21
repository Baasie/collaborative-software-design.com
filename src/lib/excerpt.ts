/** A short plain-text preview drawn from a markdown body.
 *
 * Used for card previews and as the meta-description fallback when Notion
 * carries no `Meta Description`.
 */
export function excerpt(md: string, fallback = '', max = 190): string {
  let text = (md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Bare URLs read as noise in a search result and burn characters.
    // Not `\S+`: that swallows a closing bracket and leaves "Storytelling ( is".
    .replace(/\bhttps?:\/\/[^\s)\]]+/g, ' ')
    .replace(/^\s*#{1,6}\s+.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    // Tidy what removing a URL leaves behind: empty brackets, then the spaces
    // that used to sit around them.
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) text = fallback;
  if (text.length <= max) return text;

  // Prefer to stop at a sentence. Cutting mid-sentence and adding an ellipsis
  // reads as truncated rather than written. Only fall back to a word boundary
  // when there is no sentence end in a reasonable part of the window.
  const window = text.slice(0, max + 1);
  const lastStop = Math.max(
    window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '),
  );
  if (lastStop >= max * 0.6) return window.slice(0, lastStop + 1);
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}
