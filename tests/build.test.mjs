/** What every built page must be true of. Reads `dist`, so it fails on what
 *  ships. Needs `npm run build` first; `npm test` does that. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

test('a public training date that has passed is not on the site', () => {
  // The reason the `Public trainings` database exists. The WordPress page
  // carried a hand-typed "Tickets: June 16 to 17 / Amsterdam" long after June,
  // because a date written into a page has no idea what it means.
  //
  // This holds the built HTML against the data rather than against a rule: it
  // works out which runs should be showing today and checks the pages show
  // exactly those. A page that forgot to filter, or filtered on the wrong
  // boundary, fails here even though every unit test still passes.
  const runs = JSON.parse(readFileSync('src/content/sessions.json', 'utf8'));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
  const live = runs.filter((r) => (r.end ?? r.start) >= today);
  const past = runs.filter((r) => (r.end ?? r.start) < today);

  const withBand = pages.filter((f) => read(f).includes('data-test="public-dates"'));

  if (live.length === 0) {
    assert.equal(withBand.length, 0,
      'no run is open, so no page should be showing a dates band');
  } else {
    // Both pages that carry the band must carry every open run, so the two
    // cannot disagree about what is bookable.
    assert.ok(withBand.length >= 2,
      `${live.length} run(s) are open but only ${withBand.length} page(s) show them`);
    for (const f of withBand) {
      for (const r of live) {
        assert.match(read(f), new RegExp(`/training/${r.slug}/`),
          `${urlOf(f)} shows a dates band without the open run for ${r.slug}`);
      }
    }
  }

  // And nothing anywhere prints a finished run's date.
  for (const r of past) {
    const day = new Date(`${r.start}T12:00:00Z`).toLocaleDateString('en-GB', {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
    });
    for (const f of pages) {
      assert.ok(!read(f).includes(day),
        `${urlOf(f)} still advertises ${day}, which is over`);
    }
  }
});

test('a long workshop page carries its contents and a following booking bar', () => {
  // The workshop page is 7.7 screens on a desktop and 13.5 on a phone. Three
  // things keep that navigable, and all three are easy to lose in a restyle.
  const workshops = pages.filter((f) => /\/training\/[^/]+\/index\.html$/.test(f)
    && !f.endsWith('/training/index.html'));
  assert.ok(workshops.length >= 5, `only ${workshops.length} workshop pages`);

  for (const f of workshops) {
    const html = read(f);

    // 1. Every link in the contents points at a heading that is really there.
    //    Astro generates both from the same markdown, so a mismatch means the
    //    list was hand-written after all.
    // No trailing `>` in the pattern: Astro appends its scope attribute, so
    // the tag does not end where the href does.
    const slugs = [...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);
    const toc = slugs.filter((sl) => html.includes(`<h2 id="${sl}"`));
    assert.ok(toc.length >= 3, `${urlOf(f)} has a contents list of ${toc.length}`);
    for (const sl of slugs.filter((x) => x !== 'contact')) {
      assert.ok(html.includes(`id="${sl}"`), `${urlOf(f)} links to #${sl}, which is not on the page`);
    }

    // 2. A divider in Notion is a seam, drawn with `hr + h2`. This checks the
    //    seams still reach the page, NOT that every divider is one: where an
    //    editor puts a divider is their call, and a rule that fails the deploy
    //    over somebody's Notion page is the wrong kind of rule. The sync
    //    reports a divider that draws nothing; nothing here breaks.
    const hrs = (html.match(/<hr\b/g) ?? []).length;
    const seams = (html.match(/<hr[^>]*>\s*<h2\b/g) ?? []).length;
    if (hrs > 0) {
      assert.ok(seams > 0, `${urlOf(f)} has ${hrs} dividers and none of them opens a section`);
    }

    // 3. The booking bar ships hidden, so a visitor with no JavaScript never
    //    meets a bar that nothing can move.
    assert.match(html, /class="book-bar js-book-bar"[^>]*\shidden/,
      `${urlOf(f)} ships its booking bar visible`);

    // 4. And it is last, so it is last in the tab order too.
    const barAt = html.indexOf('js-book-bar');
    const contactAt = html.indexOf('data-test="contact"');
    assert.ok(barAt > contactAt, `${urlOf(f)} puts the booking bar before the contact section`);
  }
});

test('no image reaches a reader as a file name', () => {
  // Astro drops `alt=""` from a markdown image on the way to the page, so an
  // image with no caption in Notion shipped with no alt attribute at all and
  // a screen reader read the hashed file name aloud. Every `<img>` has to
  // carry an alt or be marked presentational.
  let checked = 0;
  const bare = [];
  for (const f of pages) {
    for (const tag of read(f).match(/<img\b[^>]*>/g) ?? []) {
      checked += 1;
      if (!/\salt=/.test(tag) && !/role="(presentation|none)"/.test(tag)) {
        bare.push(`${urlOf(f)}: ${tag.slice(0, 90)}`);
      }
    }
  }
  assert.ok(checked > 40, `only ${checked} images checked; the reader stopped matching`);
  assert.deepEqual(bare, []);
});

test('no page ships an empty column', () => {
  // A column with nothing in it is a hole: the Systems Design teaser had a
  // picture beside one, because the lede that used to fill it is lifted into
  // the hero. Half a row of nothing, and the paragraph that belonged there
  // sitting underneath the block.
  let checked = 0;
  for (const f of pages) {
    const html = read(f);
    if (!html.includes('class="col"')) continue;
    checked += 1;
    const empty = [...html.matchAll(/<div class="col">([\s\S]*?)<\/div>/g)]
      .filter((m) => !m[1].replace(/<[^>]+>/g, '').trim() && !/<img|<svg/.test(m[1]));
    assert.equal(empty.length, 0, `${urlOf(f)} has ${empty.length} empty column(s)`);
  }
  assert.ok(checked >= 2, `only ${checked} pages use columns; the reader stopped matching`);
});

test('no workshop page opens by saying the same thing twice', () => {
  // The lede is lifted out of the body and printed under the title, so a copy
  // left behind in the body is read twice by anybody who reads the page. That
  // shipped: the lede was looked for anywhere in the body but only removed
  // from a `Teaser` section, so a page whose heading was renamed in Notion
  // printed its opening paragraph in the hero and again underneath.
  const dir = 'src/content/trainings';
  const flat = (t) => t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/&#\d+;|&\w+;/g, ' ').replace(/\s+/g, ' ').trim();

  let checked = 0;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const teaser = readFileSync(`${dir}/${name}`, 'utf8').match(/^teaser: "(.+)"$/m)?.[1];
    if (!teaser) continue;
    checked += 1;

    const f = pages.find((x) => x.endsWith(`/training/${name.replace(/\.md$/, '')}/index.html`));
    assert.ok(f, `${name} built no page`);

    // Long enough to be this page's own sentence, short enough to survive the
    // odd word being marked up in the body but not in the front matter.
    const needle = flat(teaser.replace(/\\"/g, '"')).slice(0, 80);
    // Structured data repeats the lede on purpose, and it is not read by
    // anybody: drop the scripts before flattening, or this counts the
    // JSON-LD description as a second printing on every page.
    const visible = read(f)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    const text = flat(visible);
    const hits = text.split(needle).length - 1;
    assert.equal(hits, 1, `${urlOf(f)} prints its lede ${hits} times`);
  }
  assert.ok(checked >= 5, `only ${checked} workshops have a lede; the reader stopped matching`);
});

test('a workshop that has a picture does not share the generic card', () => {
  // `featuredImage` used to be both the hero plate and the social card, so a
  // page that moved its picture from the Notion cover into the body kept its
  // picture and silently lost its card: shared to LinkedIn it looked like
  // every other page on the site. Nothing on the page shows this, which is
  // why it is here.
  const dir = 'src/content/trainings';
  const sources = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(sources.length >= 5, `only ${sources.length} workshop sources`);

  let checked = 0;
  for (const name of sources) {
    const md = readFileSync(`${dir}/${name}`, 'utf8');
    if (!/^(featuredImage|cardImage):/m.test(md) && !/!\[[^\]]*\]\(\.\/_assets\//.test(md)) continue;
    checked += 1;

    const f = pages.find((x) => x.endsWith(`/training/${name.replace(/\.md$/, '')}/index.html`));
    assert.ok(f, `${name} built no page`);
    const og = read(f).match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    assert.ok(og, `${urlOf(f)} has a picture in Notion and no og:image at all`);
    assert.doesNotMatch(og, /og-default/,
      `${urlOf(f)} has a picture in Notion and still shares the generic card`);
  }
  assert.ok(checked >= 2, `only ${checked} workshops have a picture; the reader stopped matching`);
});

test('dist stays under its size ceiling', () => {
  // A silent prune-dist failure shows up here rather than as a slow rsync.
  const mb = dirSize(DIST) / 1e6;
  assert.ok(mb < 50, `dist is ${mb.toFixed(1)} MB, over the 50 MB ceiling`);
});
