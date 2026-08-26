/** Is what Notion holds in a URL property actually an address?
 *
 * Notion's URL property is a text box. It accepts `manning.com`, and it accepts
 * `ask Kenny`, and it says nothing about either. The schema in
 * src/content.config.ts says `z.string().url()`, so the sync would write the
 * typo into a generated file, `astro check` would reject it, and the deploy
 * would stop at its first step, before the build, before the tests, before
 * anything ships, with every other page on the site perfectly fine.
 *
 * The content report reports rather than blocks, because publishing must never
 * be hostage to an editorial typo. A URL property is the same bargain, so the
 * sync decides here (where a person can be told) rather than handing the
 * build something it is going to refuse:
 *
 *   - A missing scheme is a typing convention, not an ambiguity. `manning.com`
 *     means `https://manning.com`, and publishing that is what the editor
 *     asked for. Repaired, and said out loud in the run log.
 *   - Anything else is not an address at all. The field is left out and an
 *     editor is told, because the site now lacks a link they believe is there
 *     and only they know what it should have said.
 *
 * ## The invariant
 *
 * Whatever comes back from here must satisfy the schema that will read it. The
 * gate is `new URL()`, which is what Zod's `.url()` uses, and
 * tests/unit/usable-url.test.mjs pins that against the real schema rather than
 * trusting this comment, because the day they disagree is the day this file
 * stops being worth having.
 */

export interface UrlRead {
  /** What to publish. Absent when there is nothing usable to publish. */
  url?: string;
  /** What Notion held, when that was not already an address. */
  raw?: string;
  /** `repaired`: a scheme was missing and `https://` was assumed.
   *  `unusable`: nothing here is an address, so nothing is published. */
  problem?: 'repaired' | 'unusable';
}

const parses = (v: string) => { try { new URL(v); return true; } catch { return false; } };

/** Something with a dot in it before the first slash, i.e. a host. Without this
 *  a bare word would parse once `https://` is bolted onto the front, `nodot`
 *  becomes a perfectly valid URL pointing at a machine that does not exist,
 *  which is a worse answer than saying it is not an address. */
const looksLikeAHost = /^[^\s/]+\.[^\s/]+/;

export function usableUrl(raw: string | undefined | null): UrlRead {
  const v = (raw ?? '').trim();
  if (!v) return {};
  // Returned as typed rather than as `new URL(v).href` would render it. The
  // round trip is not lossless to look at: it puts a trailing slash on every
  // bare origin, so normalising here would rewrite already-correct content
  // files on the next sync for no reason anybody could read in the diff.
  if (parses(v)) return { url: v };
  const guess = `https://${v}`;
  if (looksLikeAHost.test(v) && parses(guess)) return { url: guess, raw: v, problem: 'repaired' };
  return { raw: v, problem: 'unusable' };
}
