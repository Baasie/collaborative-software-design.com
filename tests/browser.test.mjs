/** What only a real browser can tell us.
 *
 * Two things the static checks cannot see: whether the page is accessible once
 * the CSS has cascaded, and whether the brand colours meet contrast *as
 * rendered* — which is the half of rule 3 a machine can judge, and the half
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
// — the 2.74:1 pairing this file has caught five times now — and every test
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
    for (const v of results) found.push(`${path}: ${v.id} — ${v.nodes.join(', ')}`);
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
      // axe did not catch it either — it reports `color-contrast` as
      // INCOMPLETE, not as a violation, whenever the element sits over a
      // background image, and that band has one. So this measures them
      // directly, which is the whole point of measuring as rendered.
      for (const el of document.querySelectorAll('h1, h2, h3, .btn, .chip, .eyebrow, .panel-brand, .card-excerpt, .hero-lede, .site-nav a, .contact-explore a')) {
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

test('the navigation works without JavaScript, and the dropdown is reachable', async () => {
  // Half this site's menu is an anchor and one item is a dropdown whose parent
  // goes nowhere. Without scripting the links must simply be there: a hamburger
  // that cannot open anything is worse than no hamburger.
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } });
  const plain = await noJs.newPage();
  await plain.goto(base + '/', { waitUntil: 'load' });
  assert.ok(await plain.locator('[data-test="nav"] a').first().isVisible(), 'nav links hidden without JS');
  // The submenu's two real pages must be reachable too.
  assert.ok(await plain.locator('[data-test="nav"] a[href="/training/"]').isVisible());
  assert.ok(await plain.locator('[data-test="nav"] a[href="/facilitation/"]').isVisible());
  await noJs.close();

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
