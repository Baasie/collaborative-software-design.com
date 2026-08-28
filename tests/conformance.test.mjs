/** The rules in AGENTS.md, as far as a machine can read them.
 *
 * Every test names the rule it enforces. If you add a rule to AGENTS.md, either
 * add a test here or write "nobody" beside it. A rule that sounds enforced and
 * is not costs more than an honest habit, because it gets assumed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (f) => readFileSync(f, 'utf8');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const components = [...walk('src/components'), ...walk('src/layouts'), ...walk('src/pages')]
  .filter((f) => f.endsWith('.astro'));

/** The file with its comments blanked out, line numbers intact.
 *
 * A comment cannot set a colour, and this codebase deliberately cites the live
 * site's CSS in its comments (`#E37B45`, `color:#000000!important`) which is
 * exactly the documentation rule 3 wants and exactly what a naive scan flags.
 * Blanked rather than removed so a reported line number still points at the
 * real line. */
function code(f) {
  return read(f)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

test('rule 3: the brand is the fixed point, no colour literals outside tokens.css', () => {
  // Swapping or correcting the brand must stay a one-file change. A hex in a
  // component is what makes it a twenty-file change nobody finishes, and this
  // site has already had its palette replaced once.
  const COLOUR = /(#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/;
  const offenders = [];
  for (const f of [...components, 'src/styles/global.css', 'src/styles/patterns.css']) {
    for (const [i, line] of code(f).split('\n').entries()) {
      if (!COLOUR.test(line)) continue;
      // `theme-color` is a meta tag read by the browser chrome before any CSS
      // has loaded, so it cannot be a custom property. Named, so it cannot spread.
      if (/name="theme-color"/.test(line)) continue;
      offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `colour literals outside tokens.css:\n${offenders.join('\n')}`);
});

test('rule 3: nothing hard-codes a font family either', () => {
  const offenders = [];
  for (const f of [...components, 'src/styles/global.css', 'src/styles/patterns.css']) {
    for (const [i, line] of code(f).split('\n').entries()) {
      if (!/font-family:/.test(line)) continue;
      if (/var\(--font-/.test(line)) continue;
      offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('rule 5: tests select [data-test] and js-* hooks, never a styling class', () => {
  // So that restyling a section cannot break a test.
  //
  // ONE exemption, named rather than pattern-matched so it cannot spread: the
  // contrast test in browser.test.mjs. Rule 5 exists so restyling cannot break
  // a test. But that test is *about* the styling. It asks "every element
  // carrying a brand fill", which only the styling classes can answer, and it
  // is supposed to break when a fill changes. Adding data-test hooks to every
  // button and panel to satisfy the letter of the rule would defeat its purpose.
  const EXEMPT = new Set(['tests/browser.test.mjs']);
  const styles = ['src/styles/global.css', 'src/styles/patterns.css'].map(read).join('\n');
  const defined = new Set([...styles.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const offenders = [];
  for (const f of walk('tests').filter((f) => f.endsWith('.test.mjs') && !f.endsWith('conformance.test.mjs'))) {
    if (EXEMPT.has(f)) continue;
    for (const [, cls] of read(f).matchAll(/(?:querySelector(?:All)?|locator)\([`'"]\.([\w-]+)/g)) {
      if (cls.startsWith('js-')) continue;
      if (defined.has(cls)) offenders.push(`${f}: selects .${cls}, which the stylesheets define`);
    }
  }
  assert.deepEqual(offenders, []);
});

/** Hooks on a block that renders only when there is content for it.
 *
 *  `public-dates` is the whole list: the dates block renders nothing when no
 *  run is open, which is the normal state between dates and not an empty state
 *  to design around. On 28 August the last scheduled run came out of Notion
 *  and this rule failed on a site that was working exactly as intended.
 *
 *  The tests that use it handle the absence themselves, which is where that
 *  belongs: `the dates on /training/ belong to neither band they sit between`
 *  checks the hero offers a way to ask for a date instead, and `a public
 *  training date that has passed is not on the site` derives what should show
 *  from `sessions.json` and would catch a hook that stopped rendering while
 *  runs existed. */
const CONDITIONAL = new Set(['public-dates']);

test('rule 5: every [data-test] hook a test uses actually exists in the build', () => {
  // The half of the rule that rots silently: a hook renamed in a component
  // leaves a test selecting nothing, which passes.
  const html = walk('dist').filter((f) => f.endsWith('.html')).map(read).join('\n');
  const used = new Set();
  for (const f of walk('tests').filter((f) => f.endsWith('.test.mjs'))) {
    for (const [, hook] of read(f).matchAll(/\[data-test="([\w-]+)"\]/g)) used.add(hook);
  }
  const missing = [...used]
    .filter((h) => !CONDITIONAL.has(h))
    .filter((h) => !html.includes(`data-test="${h}"`));
  assert.deepEqual(missing, [], `tests select hooks nothing renders: ${missing.join(', ')}`);

  // The exemption is not a free pass: a hook listed above that no test uses
  // any more is a stale entry, and this rule is the only thing that would say
  // so.
  for (const h of CONDITIONAL) {
    assert.ok(used.has(h), `${h} is exempt from this rule and no test selects it`);
  }
});

test('rule 1: Notion is the source of truth, so content carries the sync’s shape', () => {
  // This cannot prove nobody hand-edited a file, but it can prove every file
  // still has the front matter the sync writes and the schema demands.
  for (const f of walk('src/content/writing').filter((f) => f.endsWith('.md'))) {
    const fm = read(f).match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${f} has no front matter`);
    assert.match(fm[1], /^title: "/m, `${f} has no title`);
    assert.match(fm[1], /^section: "dear-como"$/m, `${f} has no known section`);
    assert.match(fm[1], /^status: "/m, `${f} has no status`);
  }
  for (const f of walk('src/content/trainings').filter((f) => f.endsWith('.md'))) {
    const fm = read(f).match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${f} has no front matter`);
    assert.match(fm[1], /^title: "/m, `${f} has no title`);
    assert.match(fm[1], /^order: \d+$/m, `${f} has no order`);
  }
});

test('rule 2: URLs are promises, .htaccess is generated, never hand-edited', () => {
  assert.match(read('public/.htaccess'), /^# GENERATED by scripts\/build-redirects\.mjs, do not edit\./);
});

test('rule 2: every address the WordPress site answers is in the inventory', () => {
  // data/live-urls.txt is the promise. If a crawl finds an address that is not
  // in it, the inventory is what is wrong, not the site.
  const urls = read('data/live-urls.txt').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.ok(urls.length >= 42, `only ${urls.length} addresses inventoried; the crawl found 42`);
  for (const must of ['/', '/training/', '/faq/', '/facilitation/', '/category/dear-como/', '/author/kenny/']) {
    assert.ok(urls.includes(must), `${must} is missing from the inventory`);
  }
  // All fifteen letters, at the address WordPress actually serves them from.
  assert.equal(urls.filter((u) => u.startsWith('/dear-como/')).length, 15);
});

test('rule 8: feature ideas go to Notion, not into a file in this repository', () => {
  const offenders = walk('.').filter((f) =>
    !f.includes('node_modules') && !f.includes('/.git/') && !f.startsWith('dist')
    && /(^|\/)(TODO|FIXME|IDEAS|BACKLOG)(\.md)?$/i.test(f));
  assert.deepEqual(offenders, []);
});

test('the sync is the only writer under src/content/', () => {
  const offenders = walk('scripts')
    .filter((f) => f.endsWith('.ts') || f.endsWith('.mjs'))
    .filter((f) => !f.endsWith('sync-notion.ts') && /writeFileSync\([^)]*src\/content/.test(read(f)));
  assert.deepEqual(offenders, []);
});

test('every page renders through BaseLayout', () => {
  // So the canonical, the OG tags, the skip link and the search opt-in cannot
  // be forgotten on a new page.
  for (const f of components.filter((f) => f.startsWith('src/pages'))) {
    assert.match(read(f), /BaseLayout|ChapterLayout/, `${f} uses no layout`);
  }
});

test('the navigation is defined once', () => {
  // The header reads src/lib/nav.ts. A second list is a second thing to keep
  // in step. Which is why the footer, now that it is the live site's single
  // credit line, holds no navigation at all rather than a copy of the menu.
  const layout = read('src/layouts/BaseLayout.astro');
  assert.match(layout, /from '\.\.\/lib\/nav'/);
  assert.ok(!/href="\/training\/"/.test(layout.split('<footer')[0].replace(/NAV/g, '')),
    'BaseLayout hard-codes a nav href instead of reading src/lib/nav.ts');
});
