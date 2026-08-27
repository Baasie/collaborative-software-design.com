import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kebab, richText, teaserOf, tidyColumns, tidyDividers, withoutLede, imageExt, isAssetFor, createBlocksToMd,
} from '../../scripts/lib/notion-md.ts';

const md = () => createBlocksToMd({ childrenOf: async () => [], downloadImage: async () => null });
const heading = (level, text) => ({ type: `heading_${level}`, [`heading_${level}`]: { rich_text: text === null ? [] : [{ plain_text: text, annotations: {} }] } });

test('kebab folds accents rather than dropping them', () => {
  assert.equal(kebab('Gáspár Nagy'), 'gaspar-nagy');
  assert.equal(
    kebab('Collaborative Software Design: How to facilitate domain modelling decisions'),
    'collaborative-software-design-how-to-facilitate-domain-modelling-decisions',
  );
});

test('rich text carries annotations and links', () => {
  assert.equal(richText([
    { plain_text: 'bold', annotations: { bold: true } },
    { plain_text: ' and ', annotations: {} },
    { plain_text: 'a link', annotations: {}, href: 'https://example.com' },
  ]), '**bold** and [a link](https://example.com)');
});

test('a Notion page mention does not become a dead link to a page id', () => {
  assert.equal(
    richText([{ plain_text: 'Some page', annotations: {}, href: '/e342ff0d1c2b4a5f8e9d0c1b2a3f4e5d' }]),
    'Some page',
  );
});

test('Notion columns become HTML wrappers with markdown still inside them', async () => {
  // The blank lines are the whole trick. A CommonMark HTML block ends at one,
  // so everything between the wrappers is parsed as markdown; written tighter,
  // the column would ship as literal text.
  const children = {
    list: [
      { id: 'a', type: 'column', column: { width_ratio: 0.5 }, has_children: true },
      { id: 'b', type: 'column', column: { width_ratio: 0.5 }, has_children: true },
    ],
    a: [{ type: 'heading_2', has_children: false, heading_2: { rich_text: [{ plain_text: 'Left' }] } }],
    b: [{ type: 'paragraph', has_children: false, paragraph: { rich_text: [{ plain_text: 'Right' }] } }],
  };
  const md = createBlocksToMd({
    childrenOf: async (id) => children[id] ?? [],
    downloadImage: async () => null,
  });
  const out = await md.blocksToMd(
    [{ id: 'list', type: 'column_list', has_children: true, column_list: {} }], null);

  assert.match(out, /<div class="cols" style="--tracks: 50fr 50fr">/);
  assert.equal((out.match(/<div class="col">/g) ?? []).length, 2);
  // A blank line after every opening tag and before every closing one.
  assert.match(out, /<div class="col">\n\n## Left\n\n<\/div>/);
  assert.match(out, /<div class="col">\n\nRight\n\n<\/div>/);
});

test('a column with no ratio takes an equal share', async () => {
  const children = {
    list: [
      { id: 'a', type: 'column', column: {}, has_children: false },
      { id: 'b', type: 'column', column: {}, has_children: false },
      { id: 'c', type: 'column', column: {}, has_children: false },
    ],
  };
  const md = createBlocksToMd({
    childrenOf: async (id) => children[id] ?? [],
    downloadImage: async () => null,
  });
  const out = await md.blocksToMd(
    [{ id: 'list', type: 'column_list', has_children: true, column_list: {} }], null);
  assert.match(out, /--tracks: 33fr 33fr 33fr/);
});

test('a divider that draws nothing is dropped rather than reported', () => {
  // All three are things an editor does without thinking about it, and none of
  // them is a mistake worth telling somebody about.
  assert.equal(tidyDividers('---\n\n## One\n\nText.'), '## One\n\nText.', 'leading');
  assert.equal(tidyDividers('## One\n\nText.\n\n---\n'), '## One\n\nText.', 'trailing');
  assert.equal(tidyDividers('## One\n\n---\n\n---\n\n## Two'), '## One\n\n---\n\n## Two', 'doubled');
});

test('a divider that is a real seam survives', () => {
  const body = '## One\n\nText.\n\n---\n\n## Two\n\nMore.';
  assert.equal(tidyDividers(body), body);
});

test('withoutLede removes the one paragraph the frontmatter carries', () => {
  const body = '## Teaser\n\nThe pitch.\n\n## About the Workshop\n\nThe rest.';
  assert.equal(withoutLede(body), '## About the Workshop\n\nThe rest.');
  // The lede is still extractable from the ORIGINAL, which is the order the
  // sync uses: read it out, then take it away.
  assert.equal(teaserOf(body), 'The pitch.');
});

test('withoutLede KEEPS the rest of the teaser section', () => {
  // The thing the old `withoutTeaser` threw away. The Collaborative Software
  // Design teaser is a hook followed by two columns expanding on it, and the
  // columns never reached the site at all.
  const body = [
    '## Teaser', '', 'The hook.', '',
    '<div class="cols" style="--tracks: 50fr 50fr">', '',
    '<div class="col">', '', 'Left.', '', '</div>', '',
    '<div class="col">', '', 'Right.', '', '</div>', '',
    '</div>', '', '---', '', '## About the workshop', '', 'Body.',
  ].join('\n');

  assert.equal(teaserOf(body), 'The hook.');
  const out = withoutLede(body);
  assert.ok(!out.includes('The hook.'), 'the lede is not printed twice');
  assert.ok(!out.includes('## Teaser'), 'and the section keeps no heading of its own');
  assert.ok(out.includes('Left.') && out.includes('Right.'), 'the columns survive');
  assert.ok(out.startsWith('<div class="cols"'), 'and they are still the first thing on the page');
});

test('withoutLede still takes the lede when there is no Teaser section', () => {
  // This used to leave the body alone, and that was the bug: `teaserOf` reads
  // the lede from anywhere in the body, so a page with no `Teaser` heading had
  // its opening paragraph printed in the hero and left in place underneath.
  // The Collaborative Software Design page renamed its heading in Notion and
  // opened by saying the same thing twice.
  const body = '<div class="col">\n\nThe pitch.\n\nThe rest.\n\n</div>';
  assert.equal(teaserOf(body), 'The pitch.');
  const out = withoutLede(body);
  assert.ok(!out.includes('The pitch.'), 'the lede is not printed twice');
  assert.ok(out.includes('The rest.'), 'and the paragraph under it survives');
  assert.ok(out.startsWith('<div class="col">'), 'inside the column it was written in');
});

test('withoutLede leaves a body with no prose in it alone', () => {
  const body = '## Agenda\n\n![](./_assets/one.png)\n\n### Day one';
  assert.equal(teaserOf(body), undefined);
  assert.equal(withoutLede(body), body);
});

test('withoutLede stops at the next heading of any depth', () => {
  assert.equal(
    withoutLede('## Teaser\n\nPitch.\n\n### Deeper\n\nKept.'),
    '### Deeper\n\nKept.',
  );
});

test('a teaser that opens with columns does not hand back a div as its pitch', () => {
  const body = '## Teaser\n\n<div class="cols">\n\n<div class="col">\n\nWords.\n\n</div>\n\n</div>';
  assert.equal(teaserOf(body), 'Words.');
});

test('teaserOf prefers the Teaser section', () => {
  assert.equal(teaserOf('## About\n\nNot this.\n\n## Teaser\n\nThis one.\n\n## Agenda\n\nNor this.'), 'This one.');
});

test('teaserOf finds the Teaser however deep the heading was shifted', () => {
  // One workshop opens at heading_1, so its Teaser renders as `###`.
  assert.equal(teaserOf('### Teaser\n\nStill found.'), 'Still found.');
});

test('teaserOf falls back to the first paragraph of prose', () => {
  assert.equal(teaserOf('# Heading\n\n![](./_assets/x.png)\n\nThe first real paragraph.'), 'The first real paragraph.');
});

test('teaserOf collapses the newlines a Notion paragraph can carry', () => {
  assert.equal(teaserOf('## Teaser\n\nOne line\nand its wrap.'), 'One line and its wrap.');
});

test('imageExt trusts the bytes, not the extension', () => {
  assert.equal(imageExt(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'png');
  assert.equal(imageExt(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(12)])), 'jpg');
  // A viewer page answering 200 at an address ending `.png` is not an image.
  assert.equal(imageExt(Buffer.from('<!doctype html><html><head>…')), null);
  assert.equal(imageExt(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg');
});

test('an asset name does not answer for a longer one', () => {
  // `body-1` must not match `body-11`, or a page steals another's picture.
  assert.ok(isAssetFor('slug-body-1.jpg', 'slug', 'body-1'));
  assert.ok(!isAssetFor('slug-body-11.jpg', 'slug', 'body-1'));
  assert.ok(!isAssetFor('slug-two-featured.jpg', 'slug', 'featured'));
});

test('headings are shifted so the shallowest becomes h2', async () => {
  // The page title is the only h1. A body opening at heading_2 must not produce
  // an h3, which tells a screen reader about a level that is not there.
  assert.equal(await md().blocksToMd([heading(2, 'Top'), heading(3, 'Under')], null), '## Top\n\n### Under');
});

test('a body that already starts at heading_1 is brought up to h2', async () => {
  assert.equal(await md().blocksToMd([heading(1, 'Top'), heading(2, 'Under')], null), '## Top\n\n### Under');
});

test('an empty Notion heading is dropped rather than rendered', async () => {
  // Two of the workshop pages carry one. Rendered, it is an empty <h2></h2>,
  // an axe violation and a heading announced with nothing in it.
  assert.equal(await md().blocksToMd([heading(2, null), heading(2, 'Teaser')], null), '## Teaser');
});

test('an empty heading gets no vote on where the rest of the document sits', async () => {
  // If it counted, an empty heading_1 above a body of heading_2s would shift
  // every real heading down a level for no reason anybody could see.
  assert.equal(await md().blocksToMd([heading(1, '  '), heading(2, 'Real')], null), '## Real');
});

test('a nested child page is skipped, not published', async () => {
  // Two workshops hold an older draft of themselves as a nested page.
  const blocks = [{ type: 'child_page', child_page: { title: 'Old draft' } }, heading(2, 'Real')];
  assert.equal(await md().blocksToMd(blocks, null), '## Real');
});

/** The wrappers the sync emits, with a null for a column the lede emptied. */
const colBlock = (...cols) => [
  '<div class="cols" style="--tracks: 50fr 50fr">', '',
  ...cols.flatMap((c) => ['<div class="col">', '', ...(c ? [c, ''] : []), '</div>', '']),
  '</div>',
].join('\n');

test('a column the lede left is filled by the paragraph under the block', () => {
  // The Systems Design teaser in Notion is the opening line beside a picture.
  // The line goes to the hero, and what was left was a picture beside nothing,
  // with the paragraph that belonged next to it sitting underneath it. The
  // page looked nothing like the page in Notion.
  const body = colBlock('', '![](./_assets/two-books.jpg)')
    + '\n\nUncover the power of it.\n\n---\n\n## About';
  const out = tidyColumns(body);

  assert.ok(!/<div class="col">\s*<\/div>/.test(out), 'no column ships empty');
  assert.ok(out.indexOf('Uncover the power of it.') < out.indexOf('two-books.jpg'),
    'the paragraph is in the column the lede left, beside the picture');
  assert.ok(out.includes('## About'), 'and the rest of the page is where it was');
});

test('with nothing prose to move up, the empty column goes and one column is unwrapped', () => {
  const out = tidyColumns(colBlock('', '![](./_assets/two-books.jpg)') + '\n\n## About');
  assert.equal(out, '![](./_assets/two-books.jpg)\n\n## About');
});

test('tidyColumns leaves a block whose columns are all full alone', () => {
  // The Collaborative Software Design teaser: prose one side, book the other.
  const body = colBlock('The pitch.', '![](./_assets/book.jpg)') + '\n\n---\n\n## About';
  assert.equal(tidyColumns(body), body);
});
