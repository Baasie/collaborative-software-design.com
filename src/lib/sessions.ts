/** The scheduled public runs of a workshop.
 *
 * The reason this exists at all: the WordPress training page carried a
 * hand-typed "Tickets: June 16 to 17 / Amsterdam" button, and it was still
 * carrying it long after June. A date written into a page goes stale and stays
 * stale, because nothing about the page knows what a date means.
 *
 * A row in the `Public trainings` database does know. `upcoming()` drops a run
 * the day after it ends, so the site cannot advertise something that has
 * already happened. Nobody has to remember to take it down.
 *
 * THE ONE THING TO KNOW: this is a static site, so "today" is the day it was
 * BUILT, not the day it is read. A run therefore lingers until the next
 * deploy, which is why `deploy.yml` also runs on a daily schedule. Without
 * that, a Friday date would sit there all weekend.
 *
 * Nothing here imports `astro:content`, so `tests/unit/sessions.test.mjs` can
 * load it without a build. Reading the collection lives in `collections.ts`,
 * which returns `Session[]`; the compiler checks the zod schema still fits
 * this shape at that one boundary.
 */

export interface Session {
  /** The workshop's slug, so a run finds its page without a second table. */
  slug: string;
  /** Notion's row title. Editorial shorthand, never shown. */
  name: string;
  start: string;
  /** Absent for a one-day run. */
  end?: string;
  /** Absent for an online run. */
  city?: string;
  delivery?: string;
  language?: string;
  price?: number;
  tickets?: string;
  /** `Announced`, `Open` or `Sold out`. */
  status: string;
}

/** The last day a run is still worth showing.
 *
 * A one-day run has no end date, so its start is its end. Compared as plain
 * `YYYY-MM-DD` strings rather than as `Date` objects: Notion writes a bare
 * calendar date, and turning that into a `Date` puts it at midnight UTC, which
 * makes a workshop in Amsterdam end the previous evening for anyone building
 * west of Greenwich.
 */
export const lastDay = (s: Session): string => s.end ?? s.start;

/** Every run that has not finished, soonest first.
 *
 * `today` is injected rather than read from the clock so the unit test does
 * not have to move time, and so a build can be reproduced.
 */
export function upcoming(sessions: Session[], today: string): Session[] {
  return sessions
    .filter((s) => lastDay(s) >= today)
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

/** Runs of one workshop, soonest first. */
export function upcomingFor(sessions: Session[], slug: string, today: string): Session[] {
  return upcoming(sessions.filter((s) => s.slug === slug), today);
}

/** Today as `YYYY-MM-DD` in the site's own timezone.
 *
 * `en-CA` because it formats as `YYYY-MM-DD`, which is the format Notion
 * hands back and the one that sorts correctly as a string. Europe/Amsterdam
 * because that is where the workshops are run from: a build at 01:00 UTC
 * should already be "tomorrow" for a run starting that morning.
 */
export const todayISO = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });

/** "17 to 18 November 2026", or "17 November 2026" for a single day.
 *
 * The month and year are printed once when a run does not cross either, which
 * is almost every run. Written out rather than left to `Intl.DateTimeFormat`
 * on a range, because the browser-independent output matters more here than
 * the locale handling: this string is baked into the HTML at build time.
 */
export function dateRange(s: Session): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

  const start = s.start;
  const end = s.end;
  if (!end || end === start) return fmt(start, { day: 'numeric', month: 'long', year: 'numeric' });

  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (sameMonth) {
    return `${fmt(start, { day: 'numeric' })} to ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  if (sameYear) {
    return `${fmt(start, { day: 'numeric', month: 'long' })} to ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return `${fmt(start, { day: 'numeric', month: 'long', year: 'numeric' })} to ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** "17 Nov 2026". The start day only.
 *
 * For a list where the date is a flag beside a title rather than the thing
 * being read: the full range is one click away, and a five-row list of long
 * dates is harder to scan than five short ones.
 */
export function shortDate(s: Session): string {
  return new Date(`${s.start}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** "Amsterdam", "Online", or "Amsterdam, in person" when both are known. */
export function where(s: Session): string | undefined {
  if (s.city && s.delivery && s.delivery !== 'Online') return `${s.city}, ${s.delivery.toLowerCase()}`;
  return s.city ?? s.delivery ?? undefined;
}
