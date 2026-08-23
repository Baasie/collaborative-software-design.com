/** What every built page must be true of. Reads `dist`, so it fails on what
 *  ships. Needs `npm run build` first; `npm test` does that. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { DIST, htmlFiles, read, urlOf, dirSize } from './helpers.mjs';

const pages = htmlFiles();

test('the build produced pages at all', () => {
  assert.ok(pages.length > 25, `only ${pages.length} pages built`);
});

test('every page has exactly one h1', () => {
  for (const f of pages) {
    const count = (read(f).match(/<h1[\s>]/g) ?? []).length;
    assert.equal(count, 1, `${urlOf(f)} has ${count} h1 elements`);
  }
});

test('every page has a title and a canonical', () => {
  for (const f of pages) {
    const html = read(f);
    assert.match(html, /<title>[^<]+<\/title>/, `${urlOf(f)} has no title`);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+"/, `${urlOf(f)} has no canonical`);
  }
});

test('every indexable page has a meta description', () => {
  for (const f of pages) {
    const html = read(f);
    if (html.includes('name="robots" content="noindex')) continue;
    assert.match(html, /<meta name="description" content="[^"]+"/, `${urlOf(f)} has no description`);
  }
});

test('every internal link ends in a slash', () => {
  // trailingSlash: 'always'. A link without one costs a 301 on every visit, and
  // the whole point of the redirect machinery is that nothing this site links
  // to should ever need one.
  const EXEMPT = /\.(html|xml|txt|md|png|jpg|jpeg|webp|svg|ico|css|js|json|woff2?|ttf)$/;
  for (const f of pages) {
    for (const [, href] of read(f).matchAll(/href="(\/[^"#?]*)"/g)) {
      if (href === '/' || href.endsWith('/') || EXEMPT.test(href)) continue;
      assert.fail(`${urlOf(f)} links to ${href}, which has no trailing slash`);
    }
  }
});

test('no internal link points at a page that was not built', () => {
  for (const f of pages) {
    for (const [, href] of read(f).matchAll(/href="(\/[^"#?]*)"/g)) {
      const target = href.endsWith('/') ? `${DIST}${href}index.html` : `${DIST}${href}`;
      assert.ok(existsSync(target), `${urlOf(f)} links to ${href}, which is not in the build`);
    }
  }
});

test('the Manning link keeps its affiliate parameters', () => {
  // `a_aid` and `a_bid` are the authors' affiliate identifiers. A "cleaner"
  // link silently costs them the revenue on every sale the site sends, and
  // nothing else in the build would ever notice.
  const home = read(`${DIST}/index.html`);
  assert.match(home, /manning\.com\/books\/collaborative-software-design\?[^"]*a_aid=baas/);
  assert.match(home, /manning\.com\/books\/collaborative-software-design\?[^"]*a_bid=2f174b8d/);
  // And it is on every page, because the header carries it.
  for (const f of pages) {
    if (read(f).includes('data-test="buy-book"')) {
      assert.match(read(f), /a_aid=baas/, `${urlOf(f)} has a Buy book button with no affiliate id`);
    }
  }

  // EVERY Manning link, not just the button. Two workshop pages linked to the
  // book from their Notion bodies with a bare URL, which loses the credit on
  // every sale they send, and the check above could not see it: those pages
  // also carry the header's button, so `a_aid=baas` appeared somewhere in the
  // file and the page passed. A link written in Notion is still a link.
  const bare = [];
  for (const f of pages) {
    for (const [, url] of read(f).matchAll(/href="(https:\/\/[^"]*manning\.com\/books\/collaborative-software-design[^"]*)"/g)) {
      if (!url.includes('a_aid=baas')) bare.push(`${urlOf(f)}: ${url}`);
    }
  }
  assert.deepEqual([...new Set(bare)], [],
    `Manning links with no affiliate id:\n${[...new Set(bare)].join('\n')}`);
});

test('the sitemap, robots and /search/ agree about what is indexable', () => {
  const sitemap = read(`${DIST}/sitemap-0.xml`);
  for (const f of pages) {
    const html = read(f);
    const noindex = html.includes('name="robots" content="noindex');
    const inSitemap = sitemap.includes(`<loc>https://collaborative-software-design.com${urlOf(f)}</loc>`);
    if (noindex) {
      assert.ok(!inSitemap, `${urlOf(f)} is noindex but is in the sitemap`);
      // A page kept out of Google is kept out of our own search, for the same
      // reason: an empty result is not an answer worth offering.
      assert.ok(!html.includes('data-pagefind-body'), `${urlOf(f)} is noindex but is indexed by search`);
    }
  }
});

test('no page ships an empty heading', () => {
  // They arrive from Notion, where pressing `##` and changing your mind leaves
  // one behind. The converter drops them; this is the net.
  for (const f of pages) {
    for (const [, tag] of read(f).matchAll(/<(h[1-6])[^>]*>\s*<\/\1>/g)) {
      assert.fail(`${urlOf(f)} ships an empty <${tag}>`);
    }
  }
});

test('the mailto links carry an encoded subject', () => {
  // A raw `&` or a space in a mailto query truncates it in some clients, which
  // silently drops the "training or consulting" label the authors filter on.
  for (const f of pages) {
    for (const [, href] of read(f).matchAll(/href="(mailto:[^"]+)"/g)) {
      if (!href.includes('?')) continue;
      assert.ok(!/[?&]subject=[^&]*\s/.test(href), `${urlOf(f)} has an unencoded space in ${href}`);
    }
  }
});

test('dist stays under its size ceiling', () => {
  // A silent prune-dist failure shows up here rather than as a slow rsync.
  const mb = dirSize(DIST) / 1e6;
  assert.ok(mb < 50, `dist is ${mb.toFixed(1)} MB, over the 50 MB ceiling`);
});
