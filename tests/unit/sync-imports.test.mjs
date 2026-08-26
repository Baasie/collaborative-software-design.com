/** Does the sync still import things that exist?
 *
 * `scripts/` is outside what `astro check` looks at and nothing in `npm test`
 * runs the sync, so renaming a helper in `lib/notion-md.ts` and forgetting the
 * import in `sync-notion.ts` ships green and fails in CI, at the one moment
 * nobody is watching. That happened: `withoutTeaser` became `withoutLede` and
 * the sync crashed on its own import line.
 *
 * The script itself cannot be imported here, because it exits when there is no
 * NOTION_TOKEN. So this reads the import statements and checks them against
 * what the modules actually export, which is the half that broke.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as notionMd from '../../scripts/lib/notion-md.ts';
import * as schemaDrift from '../../scripts/lib/schema-drift.ts';
import * as usableUrl from '../../scripts/lib/usable-url.ts';

const MODULES = {
  './lib/notion-md': notionMd,
  './lib/schema-drift': schemaDrift,
  './lib/usable-url': usableUrl,
};

/** Named imports from one module path, `type` ones dropped: a type has no
 *  runtime export to look for. */
function importedFrom(src, path) {
  const at = src.indexOf(`} from '${path}'`);
  if (at === -1) return null;
  const open = src.lastIndexOf('import {', at);
  if (open === -1) return null;
  return src.slice(open + 'import {'.length, at)
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n && !n.startsWith('type '))
    .map((n) => n.split(/\s+as\s+/)[0].trim());
}

test('every helper the sync imports is one the module exports', () => {
  const src = readFileSync('scripts/sync-notion.ts', 'utf8');
  const missing = [];
  let checked = 0;

  for (const [path, mod] of Object.entries(MODULES)) {
    const names = importedFrom(src, path);
    assert.ok(names, `sync-notion.ts no longer imports from '${path}'`);
    for (const name of names) {
      checked += 1;
      if (!(name in mod)) missing.push(`${path} has no export named ${name}`);
    }
  }

  assert.ok(checked > 10, `only ${checked} imports checked; the parser stopped matching`);
  assert.deepEqual(missing, []);
});
