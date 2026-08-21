import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt } from '../../src/lib/excerpt.ts';

test('markdown emphasis and links are reduced to their words', () => {
  assert.equal(
    excerpt('A **bold** claim with a [link](https://example.com) in it.'),
    'A bold claim with a link in it.',
  );
});

test('a bare URL is removed rather than left to burn characters', () => {
  const out = excerpt('Read https://www.manning.com/books/collaborative-software-design/ first.');
  assert.ok(!out.includes('http'), out);
  assert.equal(out, 'Read first.');
});

test('images, code fences and raw HTML do not reach the description', () => {
  assert.equal(excerpt('![alt](./_assets/x.png)\n\nThe words.'), 'The words.');
  assert.equal(excerpt('```js\nconst x = 1;\n```\n\nThe words.'), 'The words.');
  // Notion emits `<br>` in a couple of letters; a description is plain text.
  assert.equal(excerpt('XoXo,<br>CoMo'), 'XoXo, CoMo');
});

test('a heading is not the excerpt', () => {
  assert.equal(excerpt('## Teaser\n\nThe words.'), 'The words.');
});

test('it prefers to stop at a sentence rather than mid-word', () => {
  const body = 'A sentence of a decent length that ends right here. And then a good deal more text after it.';
  assert.equal(excerpt(body, '', 60), 'A sentence of a decent length that ends right here.');
});

test('but not when stopping at the sentence would throw most of it away', () => {
  // A sentence end in the first 60% of the window is cutting back too far —
  // three words and a full stop reads as a mistake, not as a summary.
  const out = excerpt('Short. ' + 'and then a great deal more running well past the limit '.repeat(3), '', 60);
  assert.ok(out.endsWith('…'), out);
  assert.ok(out.length > 20, out);
});

test('an empty body falls back to what it was given', () => {
  assert.equal(excerpt('', 'The title'), 'The title');
});
