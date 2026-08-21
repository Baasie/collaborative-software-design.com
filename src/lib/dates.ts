/** One date format, in one place.
 *
 * `en-GB` and an explicit UTC time zone, because the alternative is a build
 * machine's locale deciding whether a letter was published on 03/12 or 12/03,
 * and a date shifting by a day depending on which side of midnight the runner
 * happened to be in. */
export function formatDate(d: Date | string | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(+date)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

/** The machine-readable form for a `<time datetime>`. */
export function isoDate(d: Date | string | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(+date) ? '' : date.toISOString().slice(0, 10);
}
