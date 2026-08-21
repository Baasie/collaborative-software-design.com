import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTag, normaliseTags, tagSlug } from '../../src/lib/tags.ts';

test('a known misspelling is corrected for display', () => {
  assert.equal(normaliseTag('Preperation'), 'Preparation');
});

test('but the URL keeps the misspelling, because it is a live address', () => {
  // /tag/preperation/ is an address the WordPress site answers and this site
  // redirects. Fixing the spelling here would break the redirect the moment it
  // was written.
  assert.equal(tagSlug('Preperation'), 'preperation');
  assert.equal(tagSlug('Preparation'), 'preperation');
});

test('spelling drift between the book and the database is merged', () => {
  assert.equal(normaliseTag('Collaborative modeling'), 'Collaborative modelling');
  assert.equal(normaliseTag('Collaborative modelling'), 'Collaborative modelling');
});

test('a tag nobody has seen before passes through untouched', () => {
  // The picker is the editor's. Inventing a tag is an editorial act the code
  // has no business refusing.
  assert.equal(normaliseTag('Wardley Mapping'), 'Wardley Mapping');
  assert.equal(tagSlug('Wardley Mapping'), 'wardley-mapping');
});

test('merging two spellings yields one tag, not the same tag twice', () => {
  assert.deepEqual(
    normaliseTags(['Collaborative modeling', 'Collaborative modelling', 'Facilitation']),
    ['Collaborative modelling', 'Facilitation'],
  );
});

test('order is preserved and empties are dropped', () => {
  assert.deepEqual(normaliseTags(['B', '', '  ', 'A']), ['B', 'A']);
});

test('a slug folds accents rather than dropping them', () => {
  assert.equal(tagSlug('Décision'), 'decision');
  assert.equal(tagSlug('  Power  Dynamics '), 'power-dynamics');
});
