/** Tag normalisation, shared by the sync and the pages.
 *
 * Notion's multi-select is free text with a picker in front of it, so the same
 * idea arrives spelled three ways over a year of editing. Normalising in one
 * place means a filter cannot end up split in two, and the sync and the site
 * cannot disagree about which tag a letter carries.
 *
 * Only *spelling* is fixed here. A tag nobody has seen before passes through
 * untouched: the picker is the editor's, and inventing one is an editorial act
 * the code has no business refusing.
 */

/** Misspellings and old names, mapped to what they should read as. Keys are
 *  compared after lowercasing and collapsing whitespace. */
const CANONICAL: Record<string, string> = {
  // Misspelled in Notion, and therefore in the live WordPress URL
  // (/tag/preperation/). The display is fixed here; the ADDRESS keeps the
  // misspelling, because it is a live URL and rule 2 does not care that it is
  // ugly. See `tagSlug` below.
  preperation: 'Preparation',
  // Spelling drift between the book (British) and the database.
  'collaborative modeling': 'Collaborative modelling',
  'collaborative modelling': 'Collaborative modelling',
  'behavioral patterns': 'Behavioural Patterns',
  'behavioural patterns': 'Behavioural Patterns',
};

/** Display corrections that must NOT reach the URL, because the misspelled
 *  form is a live address the old site answered. Keyed by the corrected
 *  display name, valued with the slug the web already knows. */
const LEGACY_SLUG: Record<string, string> = {
  Preparation: 'preperation',
};

export function normaliseTag(tag: string): string {
  const key = tag.trim().toLowerCase().replace(/\s+/g, ' ');
  return CANONICAL[key] ?? tag.trim();
}

/** Normalise, drop empties, and de-duplicate what the mapping just merged —
 *  a row carrying both "Collaborative modeling" and "Collaborative modelling"
 *  must come out with one tag, not the same tag twice. Order is preserved. */
export function normaliseTags(tags: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = normaliseTag(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** The URL fragment for a tag.
 *
 * `/tag/preperation/` is an address the WordPress site answers and this site
 * redirects, so the fragment it redirects *to* has to be the same word — even
 * though the tag now displays as "Preparation". Fixing the spelling in the URL
 * would break the redirect the moment it was written. */
export function tagSlug(tag: string): string {
  const display = normaliseTag(tag);
  if (LEGACY_SLUG[display]) return LEGACY_SLUG[display];
  return display
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
