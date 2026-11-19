/** Reading the content collections, in one place.
 *
 * Every page that lists something goes through here, so "what is published"
 * and "in what order" are decided once. A page that filtered for itself would
 * be a second opinion about editorial intent.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { normaliseTags } from './tags';
import type { Session } from './sessions';

export type Letter = CollectionEntry<'writing'>;

/** The statuses that mean "this is on the site".
 *
 * The sync is the real gate (a row that is not live never becomes a file) so
 * this is a second belt for content committed before a status changed. `Done`
 * counts: the Dear CoMo board uses it for a letter that has run. */
const LIVE = new Set(['Published', 'Done']);

/** Where the column lives.
 *
 * Two addresses, and both are the live site's, not a choice: the index is at
 * `/faq/` (WordPress put it there) and the letters at `/dear-como/{slug}/`.
 * It is an odd split, and it is a promise. */
export const INDEX_PATH = '/faq/';
export const LETTER_PATH = '/dear-como/';

/** Where the articles live. New, so nothing constrains it: the index and the
 *  articles share one prefix, the way an address should. */
export const ARTICLES_PATH = '/articles/';

/** Newest first, and undated last rather than first.
 *
 * A row with no Publish date sorts to `0` under a naive comparator, which puts
 * an unscheduled draft at the TOP of the index. The one place it must not be. */
function byNewest(a: Letter, b: Letter) {
  const ad = a.data.publishDate ? +new Date(a.data.publishDate) : -Infinity;
  const bd = b.data.publishDate ? +new Date(b.data.publishDate) : -Infinity;
  return bd - ad;
}

/** Everything published from the database, letters and articles together,
 *  newest first. For the places that are about the writing as a whole: the
 *  feed, and the related pieces at the foot of a page. */
export async function writing(): Promise<Letter[]> {
  return (await getCollection('writing')).filter((e) => LIVE.has(e.data.status)).sort(byNewest);
}

/** Every published Dear CoMo letter, newest first. */
export async function letters(): Promise<Letter[]> {
  return (await writing()).filter((e) => e.data.section === 'dear-como');
}

/** Every published article, newest first. */
export async function articles(): Promise<Letter[]> {
  return (await writing()).filter((e) => e.data.section === 'articles');
}

/** A piece's address, decided by its section. One function for both, so a
 *  list that mixes them (the feed, "related") cannot link an article to
 *  /dear-como/. */
export const hrefOf = (entry: Letter) =>
  `${entry.data.section === 'articles' ? ARTICLES_PATH : LETTER_PATH}${entry.id}/`;

/** Minutes to read, at 230 words a minute, never less than one. Counted off
 *  the markdown, so a table's pipes and a link's address count for nothing
 *  worth worrying about at this precision. */
export function readingMinutes(body: string): number {
  const words = body.replace(/\]\([^)]*\)/g, ']').split(/\s+/).filter((w) => /\w/.test(w)).length;
  return Math.max(1, Math.round(words / 230));
}

/** The pieces most worth reading next: most tags in common first, then
 *  newest. Anything sharing no tag is left out rather than padded in, because
 *  a "related" link that is not related teaches readers to skip the block. */
export function related(entry: Letter, pool: Letter[], max = 3): Letter[] {
  const mine = new Set(normaliseTags(entry.data.tags));
  return pool
    .filter((e) => e.id !== entry.id)
    .map((e, i) => ({ e, i, shared: normaliseTags(e.data.tags).filter((t) => mine.has(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.i - b.i)
    .slice(0, max)
    .map((x) => x.e);
}

/** The trainings, in the order the Workshops page in Notion holds them. */
export async function trainings() {
  return (await getCollection('trainings')).sort((a, b) => a.data.order - b.data.order);
}

/** Trainings grouped by their Notion heading ("2-day", "1 day or less"), with
 *  the groups in first-appearance order. A `Map`, because insertion order is
 *  the editorial order and an object would invite somebody to sort it. */
export async function trainingsByFormat() {
  const groups = new Map<string, Awaited<ReturnType<typeof trainings>>>();
  for (const t of await trainings()) {
    const key = t.data.format ?? 'Workshops';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return groups;
}

/** The scheduled public runs, unfiltered and in Notion's order.
 *
 *  The return type is the hand-written `Session` in `sessions.ts` rather than
 *  the collection's inferred one, and that is the point: the pure functions
 *  there cannot import `astro:content`, so this one line is where the compiler
 *  checks the zod schema still produces what they expect. */
export async function sessions(): Promise<Session[]> {
  return (await getCollection('sessions')).map((e) => e.data);
}

/** Every tag in use, most-used first, with its count. Drives the filter bar. */
export function tagCounts(entries: Letter[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of normaliseTags(e.data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
