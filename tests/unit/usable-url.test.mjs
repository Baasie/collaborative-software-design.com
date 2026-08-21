import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import { usableUrl } from '../../scripts/lib/usable-url.ts';

test('an address is published as typed', () => {
  // Not re-rendered through `new URL().href`, which would put a trailing slash
  // on every bare origin and rewrite correct content files for no reason.
  assert.deepEqual(usableUrl('https://example.com'), { url: 'https://example.com' });
});

test('a missing scheme is a typing convention, and is repaired', () => {
  const read = usableUrl('manning.com/books/collaborative-software-design');
  assert.equal(read.url, 'https://manning.com/books/collaborative-software-design');
  assert.equal(read.problem, 'repaired');
});

test('a bare word is not an address, and nothing is published', () => {
  // Without the host check, `nodot` becomes a valid URL pointing at a machine
  // that does not exist — a worse answer than saying it is not one.
  assert.equal(usableUrl('ask Kenny').problem, 'unusable');
  assert.equal(usableUrl('ask Kenny').url, undefined);
  assert.equal(usableUrl('nodot').problem, 'unusable');
});

test('an empty property is simply absent', () => {
  assert.deepEqual(usableUrl(''), {});
  assert.deepEqual(usableUrl(undefined), {});
});

test('whatever comes back satisfies the schema that will read it', () => {
  // The invariant the whole file exists for: the sync must never hand the build
  // a value `astro check` will reject. Pinned against the real schema rather
  // than trusting a comment.
  const schema = z.string().url();
  for (const input of ['https://x.com', 'x.com', 'ask Kenny', 'nodot', '', 'ftp://h.io/a']) {
    const { url } = usableUrl(input);
    if (url !== undefined) assert.doesNotThrow(() => schema.parse(url), `schema rejected ${url}`);
  }
});
