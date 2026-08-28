/** What only a real browser can tell us.
 *
 * Two things the static checks cannot see: whether the page is accessible once
 * the CSS has cascaded, and whether the brand colours meet contrast *as
 * rendered*. Which is the half of rule 3 a machine can judge, and the half
 * that matters most here. This brand puts magenta and orange next to each
 * other, and that pairing is 2.73:1.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

/** Some sandboxes ship a Chromium at a fixed path that does not match the
 *  revision Playwright wants; use it rather than failing with "run npx
 *  playwright install" in an image where installing is not the answer. */
const PRESET = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PRESET) ? { executablePath: PRESET } : {};

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain', '.md': 'text/markdown',
};

let server, browser, base;

before(async () => {
  // Served over http rather than file://, because module scripts and the
  // Pagefind fetches do not work from the filesystem.
  server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = join('dist', url);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(launchOptions);
});

after(async () => {
  await browser?.close();
  await new Promise((r) => server.close(r));
});

/** One page of each shape. Checking all thirty-one would be slower and would
 *  not find anything the templates do not already share. */
// One page of every KIND, because a kind is what shares a template. A new page
// that reuses an existing template is covered by the one already listed; a new
// template is not, and ADDING IT HERE IS PART OF BUILDING IT. That is not a
// style note: a page built and not listed shipped a magenta link on the orange
// (the 2.74:1 pairing this file has caught five times now) and every test
// passed, because none of them had ever loaded it.
const PAGES = [
  '/', '/faq/', '/training/', '/facilitation/',
  '/dear-como/help-quiet-members-speak-up/',
  '/training/navigating-power-dynamics-in-software-decision-making/',
  '/the-need-for-collaborative-design/',
];

test('no serious or critical accessibility violations', async () => {
  const page = await browser.newPage();
  const found = [];
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: 'load' });
    await page.addScriptTag({ path: axePath });
    const results = await page.evaluate(async () =>
      (await window.axe.run(document, { resultTypes: ['violations'] })).violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 3) })));
    for (const v of results) found.push(`${path}: ${v.id}, ${v.nodes.join(', ')}`);
  }
  await page.close();
  assert.deepEqual(found, [], `accessibility violations:\n${found.join('\n')}`);
});

test('rule 3: text on a brand fill meets contrast as rendered', async () => {
  // The half of "the brand is the fixed point" a machine can judge. This brand
  // has a specific trap in it: #9D0064 on #E37B45 is 2.73:1, so magenta text
  // must never sit directly on the orange ground.
  const page = await browser.newPage();
  const bad = [];
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: 'load' });
    const results = await page.evaluate(() => {
      const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const lum = (rgb) => 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]);
      const parse = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const ratio = (a, b) => {
        const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
      };
      /** The nearest ancestor that actually paints a background. A transparent
       *  element inherits whatever is behind it, and on this site that is
       *  usually the orange ground. */
      const groundOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return parse(bg);
        }
        return [255, 255, 255];
      };
      const out = [];
      // Headings are in this list because leaving them out hid a real failure:
      // a 60px h1 sat at 2.62:1 on the magenta band and nothing complained.
      // axe did not catch it either. It reports `color-contrast` as
      // INCOMPLETE, not as a violation, whenever the element sits over a
      // background image, and that band has one. So this measures them
      // directly, which is the whole point of measuring as rendered.
      // `p a` is in here for the same reason the headings are. The site's link
      // colour is the accent, and the accent is legible on some of these
      // grounds and not others, 4.71:1 on the blue, 3.85:1 on the pink,
      // 2.74:1 on the orange. Measuring the fills alone caught none of that.
      for (const el of document.querySelectorAll('h1, h2, h3, p a, li a, .btn, .chip, .eyebrow, .panel-brand, .card-excerpt, .hero-lede, .site-nav a, .contact-explore a')) {
        if (!el.textContent.trim()) continue;
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        out.push({
          what: el.className || el.tagName,
          ratio: ratio(parse(cs.color), groundOf(el)),
          need: large ? 3 : 4.5,
        });
      }
      return out;
    });
    assert.ok(results.length > 0, `found no brand fills to measure on ${path}`);
    for (const r of results.filter((r) => r.ratio < r.need)) {
      bad.push(`${path} ${r.what}: ${r.ratio.toFixed(2)}:1, needs ${r.need}:1`);
    }
  }
  await page.close();
  assert.deepEqual([...new Set(bad)], [], `contrast failures:\n${[...new Set(bad)].join('\n')}`);
});

test('the navigation works without JavaScript, and nothing in it hides', async () => {
  // Half this site's menu is an anchor into the home page. Without scripting
  // the links must simply be there: a hamburger that cannot open anything is
  // worse than no hamburger.
  //
  // Training and Consulting are checked by name because they are the two that
  // used to live inside a hover dropdown. They are top-level items now (see
  // src/lib/nav.ts), and this is what would notice if they went back to being
  // reachable only on hover.
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } });
  const plain = await noJs.newPage();
  await plain.goto(base + '/', { waitUntil: 'load' });
  assert.ok(await plain.locator('[data-test="nav"] a').first().isVisible(), 'nav links hidden without JS');
  assert.ok(await plain.locator('[data-test="nav"] a[href="/training/"]').isVisible());
  assert.ok(await plain.locator('[data-test="nav"] a[href="/facilitation/"]').isVisible());
  await noJs.close();

  // And on a desktop width they are visible with no interaction at all: no
  // hover, no click, nothing to discover.
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await wide.newPage();
  await desk.goto(base + '/', { waitUntil: 'load' });
  for (const href of ['/training/', '/facilitation/']) {
    assert.ok(await desk.locator(`[data-test="nav"] a[href="${href}"]`).isVisible(),
      `${href} is not visible in the menu without interacting with it`);
  }
  await wide.close();

  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  const toggle = page.locator('[data-test="nav-toggle"]');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('[data-test="nav"] a').first().isVisible());
  await ctx.close();
});

test('a portrait that zooms in on scroll is still there when it cannot', async () => {
  // The live site's author portraits start at scale(0.5) and opacity 0 and zoom
  // to full size when they scroll into view. The starting state is the whole
  // risk: anything that stops the class from ever landing leaves three
  // PERMANENTLY INVISIBLE images, which is far worse than no animation. So the
  // hidden state is behind `html.js` and this checks both halves of that.
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const plain = await noJs.newPage();
  await plain.goto(base + '/', { waitUntil: 'load' });
  const still = await plain.evaluate(() => {
    const e = document.querySelector('.js-reveal');
    if (!e) return null;
    const c = getComputedStyle(e);
    return { opacity: Number(c.opacity), transform: c.transform };
  });
  assert.ok(still, 'no .js-reveal element on the home page');
  assert.equal(still.opacity, 1, 'a revealed-on-scroll element is invisible without JavaScript');
  assert.equal(still.transform, 'none', 'and it is still scaled down');
  await noJs.close();

  // And with scripting it does animate, ending at full size rather than
  // stopping wherever the keyframes left it.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  const start = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.js-reveal')).opacity));
  assert.equal(start, 0, 'it should start hidden when it can animate');
  await page.evaluate(() => document.querySelector('.js-reveal').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.js-reveal')).transform === 'matrix(1, 0, 0, 1, 0, 0)',
    null, { timeout: 5000 });
  await ctx.close();
});

test("the Dear CoMo mark is on its index and is not the letters' picture", async () => {
  // The column has a face, the one the live page stamps above its title, and
  // dropping the cards took it off the page along with the fifteen copies of
  // it that were the problem. One is a mark; fifteen are wallpaper.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(base + '/faq/', { waitUntil: 'load' });

  const seen = await page.evaluate(() => {
    const hero = document.querySelector('.hero');
    const mark = hero.querySelector('img');
    if (!mark) return null;
    const r = mark.getBoundingClientRect();
    const cs = getComputedStyle(mark);
    return {
      size: Math.round(r.width),
      round: cs.borderRadius,
      right: Math.round(r.right),
      edge: Math.round(document.querySelector('.letters').getBoundingClientRect().right),
      alt: mark.getAttribute('alt'),
      inRows: document.querySelectorAll('[data-test="letter-card"] img').length,
    };
  });

  assert.ok(seen, '/faq/ has no mark in its hero');
  assert.ok(seen.size >= 200, `the mark renders at ${seen.size}px, which is a favicon`);
  assert.match(seen.round, /50%|9999px/, 'the mark is not a circle, so it reads as a picture');
  assert.equal(seen.right, seen.edge, `the mark ends at ${seen.right}px and the list at ${seen.edge}px`);
  assert.equal(seen.alt, '', 'the mark repeats the h1 beside it to a screen reader');
  assert.equal(seen.inRows, 0, `${seen.inRows} letters carry the same drawing again in the list`);
  await ctx.close();
});

test('the dates on /training/ belong to neither band they sit between', async () => {
  // They were a band of their own directly above the list of workshops, on
  // the same white ground the list uses: two blocks with nothing between them,
  // so neither said what it was. Then they were a white plate in the hero's
  // right column, which ran out halfway down and left a slab of dead pink.
  //
  // Now they are an ink strip on the seam. It has to be its own ground, or it
  // reads as the bottom of the pink or the top of the white, which is the
  // whole bug.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(base + '/training/', { waitUntil: 'load' });

  const seen = await page.evaluate(() => {
    const dates = document.querySelector('[data-test="public-dates"]');
    const hero = document.querySelector('[data-test="training-hero"]');
    const list = document.querySelector('.section--paper');
    const bg = (el) => getComputedStyle(el).backgroundColor;
    const y = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);
    if (!dates) {
      return { none: true, ask: !!hero.querySelector('a.btn'), flags: document.querySelectorAll('.workshop-next').length };
    }
    return {
      inHero: !!dates.closest('[data-test="training-hero"]'),
      inList: !!dates.closest('.section--paper'),
      grounds: [bg(hero), bg(dates), bg(list)],
      order: [y(hero), y(dates), y(list)],
      full: Math.round(dates.getBoundingClientRect().width),
      width: window.innerWidth,
    };
  });

  // No open run means no strip, and that is the normal state between dates.
  // The hero has to carry the only way in then.
  if (seen.none) {
    assert.ok(seen.ask, 'no date is open and the hero offers no way to ask for one');
    assert.equal(seen.flags, 0, 'the list flags a next date but the page shows none');
    await ctx.close();
    return;
  }

  assert.ok(!seen.inHero && !seen.inList, '/training/ nests its dates inside another band');
  assert.equal(new Set(seen.grounds).size, 3,
    `the hero, the dates and the list are painted ${[...new Set(seen.grounds)].join(' and ')}`);
  assert.deepEqual([...seen.order].sort((x, z) => x - z), seen.order,
    'the dates are not between the hero and the list');
  assert.equal(seen.full, seen.width, `the strip is ${seen.full}px in a ${seen.width}px window`);
  await ctx.close();
});

test('one page has one inner edge', async () => {
  // The hero ran 1.58fr beside 1fr, the columns under it run even, and the
  // band that closes the page ran 1.4fr, so the two halves of a workshop page
  // met at 806px, then 696, then 839. Every one of those edges is straight,
  // every one sits 164px from the side, and the steps between them are the
  // kind of thing you see before you can say what you are seeing.
  //
  // This sweeps every two-column grid on the page rather than the two the bug
  // was found in, because the third one was found by the sweep.
  const PAGES = [
    '/training/',
    '/training/collaborative-software-design-how-to-facilitate-domain-modelling-decisions/',
    '/training/systems-design-with-strategic-domain-driven-design-and-team-topologies/',
    '/training/technical-leadership-for-architectural-decision-making/',
  ];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: 'load' });
    const splits = await page.evaluate(() => [...document.querySelectorAll('*')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') return false;
        if (cs.gridTemplateColumns.split(' ').length !== 2) return false;
        return [...el.children].filter((k) => getComputedStyle(k).display !== 'none').length >= 2;
      })
      .map((el) => {
        const kids = [...el.children].filter((k) => getComputedStyle(k).display !== 'none');
        return {
          what: (el.className || el.tagName).toString().split(' ')[0],
          at: Math.round(kids[1].getBoundingClientRect().x),
        };
      }));

    if (!splits.length) continue;
    const seen = [...new Set(splits.map((s) => s.at))];
    assert.equal(seen.length, 1,
      `${path} splits its columns at ${splits.map((s) => `${s.what}@${s.at}`).join(', ')}`);
  }
  await ctx.close();
});

test('a picture in a column starts where the text beside it starts', async () => {
  // `.prose img` carries a 32px block margin, and the `<p>` markdown wraps a
  // lone image in has no padding or border of its own, so the margin collapses
  // straight out of it: every picture in a column began a line below the text
  // it was paired with. A 32px slip is small enough to read as sloppiness
  // rather than as a bug, which is why it stood for so long.
  const WORKSHOPS = [
    'collaborative-software-design-how-to-facilitate-domain-modelling-decisions',
    'systems-design-with-strategic-domain-driven-design-and-team-topologies',
  ];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  for (const slug of WORKSHOPS) {
    await page.goto(`${base}/training/${slug}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    });

    const rows = await page.evaluate(() => [...document.querySelectorAll('.workshop-body .cols')]
      .map((row) => [...row.children].map((col) => {
        const first = col.firstElementChild;
        const box = first.getBoundingClientRect();
        const inner = col.getBoundingClientRect();
        return { top: Math.round(box.top), fills: Math.round(inner.width - box.width) };
      })));

    assert.ok(rows.length >= 4, `${slug} renders ${rows.length} column rows`);
    for (const [i, cols] of rows.entries()) {
      const tops = cols.map((c) => c.top);
      assert.equal(new Set(tops).size, 1,
        `${slug} row ${i}: the columns start at ${tops.join(' and ')}`);
      for (const c of cols) {
        assert.equal(c.fills, 0,
          `${slug} row ${i}: something in a column is ${c.fills}px narrower than the column`);
      }
    }
  }
  await ctx.close();
});

test('the contents sit at the foot of the section they open', async () => {
  // The contents were in the hero, above everything the page opens with, and
  // that read as two beginnings: chips, and then more of the same pink band
  // underneath them. They belong at the end of the opening section, as the
  // way in to what follows.
  //
  // The body cannot be split to put them there, so they are placed with flex
  // `order`. Nothing in the DOM says where they are: in the source they are
  // the first thing in the body, and only the rendered page knows they are
  // the last. Which is why this is measured here.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + '/training/collaborative-software-design-how-to-facilitate-domain-modelling-decisions/',
    { waitUntil: 'load' });

  const seen = await page.evaluate(() => {
    const y = (el) => el.getBoundingClientRect().top + window.scrollY;
    const toc = document.querySelector('.workshop-body > .toc');
    if (!toc) return null;
    const hr = document.querySelector('.workshop-body > hr');
    const opening = [...document.querySelectorAll('.workshop-body > *')]
      .filter((el) => el !== toc && el !== hr
        && (hr.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) !== 0);
    return {
      toc: y(toc),
      tocBottom: toc.getBoundingClientRect().bottom + window.scrollY,
      firstSeam: hr ? y(hr) : null,
      lastOpening: Math.max(...opening.map((el) => el.getBoundingClientRect().bottom + window.scrollY)),
      rows: new Set([...toc.querySelectorAll('li')].map((li) => Math.round(li.getBoundingClientRect().top))).size,
      chips: toc.querySelectorAll('li').length,
    };
  });

  assert.ok(seen, 'the workshop body has no contents in it at all');
  assert.ok(seen.firstSeam !== null, 'the page has no seam to sit above');
  assert.ok(seen.toc >= seen.lastOpening,
    `the contents are at ${seen.toc}px, above the opening section which ends at ${seen.lastOpening}px`);
  assert.ok(seen.tocBottom <= seen.firstSeam + 1,
    `the contents end at ${seen.tocBottom}px, below the first seam at ${seen.firstSeam}px`);
  // A map that takes two rows is a list. Five chips are 758px and the reading
  // measure is 736, so this only holds while the row is wider than the text.
  assert.equal(seen.rows, 1, `${seen.chips} chips wrapped onto ${seen.rows} rows`);
  await ctx.close();
});

test('one page has one left edge', async () => {
  // The workshop body draws full-width bands, so its text is positioned with
  // padding rather than by a wrapper. The first version centred a 46rem column
  // in the viewport, which put the body at 352px while the hero above and the
  // blue band below stayed at 164. A 188px jog down the middle of one page,
  // and nothing failed: every unit test passed, contrast passed, axe passed.
  //
  // A second one hid inside it. The rule that puts the magenta tick on "What
  // you will learn" carries an ID, so it outranked the band padding and pulled
  // that whole list to x=0, the very edge of the screen.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + '/training/collaborative-software-design-how-to-facilitate-domain-modelling-decisions/',
    { waitUntil: 'load' });

  const edges = await page.evaluate(() => {
    const textLeft = (el) => Math.round(el.getBoundingClientRect().x + parseFloat(getComputedStyle(el).paddingLeft));
    const out = { hero: textLeft(document.querySelector('.hire h1')) };
    for (const el of document.querySelectorAll('.workshop-body > *')) {
      if (el.tagName === 'HR' || !el.textContent.trim()) continue;
      const x = textLeft(el);
      out[el.tagName.toLowerCase()] = Math.min(out[el.tagName.toLowerCase()] ?? Infinity, x);
    }
    return out;
  });

  const { hero, ...body } = edges;
  for (const [tag, x] of Object.entries(body)) {
    assert.equal(x, hero, `a <${tag}> in the workshop body starts at ${x}px, the hero starts at ${hero}px`);
  }
  await ctx.close();
});

test('no two bands meet in the same colour', async () => {
  // The body paints a band per divider, cycling white, blue, grey, and the
  // section under it is a band too. It was hard-coded blue, so the day the
  // Collaborative Software Design page grew a sixth band the Agenda ran
  // straight into "Bring this to your team": same blue, no edge, one long
  // block. Adding a divider in Notion must not be able to do that.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const bad = [];

  for (const slug of ['collaborative-software-design-how-to-facilitate-domain-modelling-decisions',
                      'navigating-power-dynamics-in-software-decision-making',
                      'systems-design-with-strategic-domain-driven-design-and-team-topologies']) {
    await page.goto(`${base}/training/${slug}/`, { waitUntil: 'load' });
    const runs = await page.evaluate(() => {
      // The body's bands, collapsed to one entry per run of colour, THEN the
      // sections under it kept whatever colour they are.
      //
      // The collapsing must not reach across the boundary. A first version
      // pushed the sections through the same de-duplicating helper, so a
      // closing band the same colour as the body's last one was folded into
      // it and the check saw nothing to complain about: the test hid exactly
      // the collision it was written for.
      const body = [];
      for (const el of document.querySelectorAll('.workshop-body > *')) {
        const bg = getComputedStyle(el).backgroundColor;
        if (!body.length || body[body.length - 1].bg !== bg) body.push({ bg, what: 'a body band' });
      }
      const after = [];
      for (const sel of ['[data-test="more-workshops"]', '[data-test="contact"]']) {
        const el = document.querySelector(sel);
        if (el) after.push({ bg: getComputedStyle(el).backgroundColor, what: sel });
      }
      return [...body, ...after];
    });

    for (let i = 1; i < runs.length; i += 1) {
      if (runs[i].bg === runs[i - 1].bg) {
        bad.push(`/training/${slug}/: ${runs[i - 1].what} and ${runs[i].what} are both ${runs[i].bg}`);
      }
    }
  }

  await ctx.close();
  assert.deepEqual(bad, []);
});

test('the tag filter narrows the index, and a /tag/ redirect lands filtered', async () => {
  const page = await browser.newPage();
  await page.goto(base + '/faq/', { waitUntil: 'load' });
  const total = await page.locator('[data-test="letter-card"]').count();
  assert.ok(total > 1, 'expected more than one letter to filter');

  await page.locator('[data-test="tag-filter"] .js-filter-btn').nth(1).click();
  const shown = await page.locator('[data-test="letter-card"]:visible').count();
  assert.ok(shown > 0 && shown < total, `filter showed ${shown} of ${total}`);
  assert.match(page.url(), /#tag=/);

  await page.locator('[data-test="tag-filter"] .js-filter-btn').first().click();
  assert.equal(await page.locator('[data-test="letter-card"]:visible').count(), total);

  // The eighteen legacy /tag/ addresses redirect straight to a hash on this
  // page, so arriving with one already set has to filter on load.
  await page.goto(base + '/faq/#tag=facilitation', { waitUntil: 'load' });
  const filtered = await page.locator('[data-test="letter-card"]:visible').count();
  assert.ok(filtered > 0 && filtered < total, `arriving at #tag=facilitation showed ${filtered} of ${total}`);
  await page.close();
});

test('an anchor in the main menu lands below the sticky header', async () => {
  // "What's inside" and "Contact" are anchors, not pages. With a sticky header
  // and no scroll-padding they arrive hidden underneath it.
  const page = await browser.newPage();
  await page.goto(base + '/#contact', { waitUntil: 'load' });
  const { top, headerBottom } = await page.evaluate(() => ({
    top: document.getElementById('contact').getBoundingClientRect().top,
    headerBottom: document.getElementById('site-header').getBoundingClientRect().bottom,
  }));
  assert.ok(top >= headerBottom - 1, `#contact starts at ${top}, under a header ending at ${headerBottom}`);
  await page.close();
});
