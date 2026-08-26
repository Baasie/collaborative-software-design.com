/** Is Notion still shaped the way the sync reads it?
 *
 * Renaming or retyping a property in Notion does not fail anything. The read
 * returns nothing, every field the sync writes is optional, so the run writes
 * the record without it, commits, and deploys green. Nobody finds out until
 * somebody notices weeks later that a field has quietly gone from every page.
 *
 * Nothing holds Notion's schema against the code, so nothing notices. This
 * does, and it costs no extra API calls: a page property arrives carrying its
 * own `type`, so the reader that asked for it already holds both halves of the
 * comparison.
 *
 * It detects rather than prevents. The rule stands, change the code first,
 * then the Notion property. This is the net for the time somebody forgets.
 */

/** The Notion property type a reader expects. */
export type Reader =
  | 'rich_text' | 'url' | 'multi_select' | 'select' | 'status' | 'date'
  | 'number' | 'files' | 'relation' | 'checkbox' | 'title';

export interface Drift {
  name: string;
  expected: Reader;
  /** What Notion says it is now. Absent when no row carried the property at
   *  all, which is a rename or a deletion rather than a retype. */
  actual?: string;
}

interface PropWatch { expected: Reader; seen: number; missing: number; actual: Set<string> }

/** Remembers which properties a run asked for, and what came back.
 *
 * Derived rather than declared. A hand-written list of the properties the sync
 * expects would be a second thing to keep in step with the readers, and two
 * things drifting apart is the entire failure being guarded against. Every
 * typed reader goes through one function, so that function is the inventory.
 */
export function schemaWatch() {
  const props = new Map<string, PropWatch>();
  return {
    /** One read. `actual` is the property object Notion returned, or undefined
     *  when the page carried nothing under that name. */
    note(name: string, expected: Reader, actual: unknown) {
      let p = props.get(name);
      if (!p) props.set(name, (p = { expected, seen: 0, missing: 0, actual: new Set() }));
      p.seen += 1;
      const type = (actual as { type?: unknown } | null | undefined)?.type;
      if (actual === undefined || actual === null) p.missing += 1;
      else if (typeof type === 'string') p.actual.add(type);
    },
    drift(): Drift[] {
      const out: Drift[] = [];
      for (const [name, p] of props) {
        // Missing from EVERY row is a rename or a deletion. Missing from some
        // is just an empty cell, which is normal and not drift.
        if (p.seen > 0 && p.missing === p.seen) {
          out.push({ name, expected: p.expected });
          continue;
        }
        for (const actual of p.actual) {
          if (actual !== p.expected) out.push({ name, expected: p.expected, actual });
        }
      }
      return out;
    },
  };
}

export function driftLines(drift: Drift[]): string[] {
  return drift.map((d) => d.actual
    ? `Notion property "${d.name}" is now a ${d.actual}; the sync reads it as a ${d.expected}.`
    : `Notion property "${d.name}" was not on any row; the sync expects a ${d.expected}. Renamed or deleted?`);
}

export function driftAlerts(section: string, sampleUrl: string, drift: Drift[]) {
  return driftLines(drift).map((detail) => ({
    kind: 'notion-schema-drift', title: section, detail, url: sampleUrl,
  }));
}
