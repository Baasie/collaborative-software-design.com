/** Rule 2: URLs are promises.
 *
 * The generator and the checker are scripts; this is what makes them run on
 * every push. `npm test` builds before it gets here, so `dist` is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('every address the WordPress site answers is served, redirected or Gone', () => {
  execFileSync('node', ['scripts/check-redirects.mjs'], { stdio: 'pipe' });
});

test('the committed .htaccess is what the generator would write today', () => {
  // A generated file that has drifted from its generator is a file somebody
  // edited by hand, which is the thing rule 2 forbids.
  const before = readFileSync('public/.htaccess', 'utf8');
  execFileSync('node', ['scripts/build-redirects.mjs'], { stdio: 'pipe' });
  assert.equal(readFileSync('public/.htaccess', 'utf8'), before,
    'public/.htaccess is stale — run `npm run redirects` and commit it');
});

test('a tag redirect keeps its fragment', () => {
  // Eighteen /tag/ addresses redirect to /faq/#tag=…. Without the [NE] flag
  // Apache escapes the `#` and the filter never sees the hash it needs.
  const htaccess = readFileSync('public/.htaccess', 'utf8');
  const rule = htaccess.split('\n').find((l) => l.includes('tag/facilitation'));
  assert.ok(rule, 'no redirect for /tag/facilitation/');
  assert.match(rule, /#tag=facilitation/);
  assert.match(rule, /\[R=301,NE,L\]/);
});

test('trailingSlash is always, and the config says so', () => {
  assert.match(readFileSync('astro.config.mjs', 'utf8'), /trailingSlash: 'always'/);
});
