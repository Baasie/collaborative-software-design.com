import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaWatch, driftLines } from '../../scripts/lib/schema-drift.ts';

test('a property missing from every row is a rename or a deletion', () => {
  const w = schemaWatch();
  w.note('Slug', 'rich_text', undefined);
  w.note('Slug', 'rich_text', undefined);
  assert.deepEqual(w.drift(), [{ name: 'Slug', expected: 'rich_text' }]);
  assert.match(driftLines(w.drift())[0], /Renamed or deleted/);
});

test('a property missing from SOME rows is just an empty cell, not drift', () => {
  // This is the distinction that makes the check usable: most rows have a blank
  // Canonical URL, and reporting that every hour would train everyone to ignore
  // the alert entirely.
  const w = schemaWatch();
  w.note('Canonicle URL (optional)', 'url', undefined);
  w.note('Canonicle URL (optional)', 'url', { type: 'url', url: 'https://x.com' });
  assert.deepEqual(w.drift(), []);
});

test('a property that changed type is reported with both types', () => {
  const w = schemaWatch();
  w.note('Tags', 'multi_select', { type: 'rich_text' });
  assert.deepEqual(w.drift(), [{ name: 'Tags', expected: 'multi_select', actual: 'rich_text' }]);
  assert.match(driftLines(w.drift())[0], /is now a rich_text; the sync reads it as a multi_select/);
});

test('a property that is what the sync expects reports nothing', () => {
  const w = schemaWatch();
  w.note('Tags', 'multi_select', { type: 'multi_select' });
  assert.deepEqual(w.drift(), []);
});
