# Testing

What blocks a deploy must be about **code being wrong**, never about somebody's
writing.

| Suite | Command | Blocks a deploy? |
|---|---|---|
| Unit — the pure logic | `npm run test:unit` | Yes |
| Build — what actually shipped into `dist` | inside `npm test` | Yes |
| Browser — what only a real browser can see | inside `npm test` | Yes |
| Conformance — the rules in AGENTS.md a machine can read | inside `npm test` | Yes |
| URLs — rule 2 | inside `npm test` | Yes |

`npm test` runs `astro check` first, because it is the cheapest thing that can
fail.

## What each one is protecting

### Unit — `tests/unit/`

Pure functions, no build, no browser. Everything here is importable because the
logic was deliberately kept **out** of `scripts/sync-notion.ts`, which exits on a
missing `NOTION_TOKEN` and so cannot be imported by a test at all. That is why
`scripts/lib/notion-md.ts`, `usable-url.ts` and `schema-drift.ts` exist as
separate files: the pure parts of the sync live where a test can reach them.

**If you add logic to the sync and cannot test it, that is the signal to move
it.**

### Build — `tests/build.test.mjs`

Reads `dist`, so it fails on what ships rather than on what a component was
meant to render. One h1 per page, a title and canonical everywhere, a meta
description on everything indexable, no internal link without a trailing slash,
no internal link to a page that was not built, `noindex`/sitemap/search all
agreeing, no empty headings, encoded mailto subjects, and `dist` under 50 MB.

Two that are not generic hygiene:

- **The Manning affiliate parameters.** `a_aid` and `a_bid` are the authors'
  revenue. A "cleaner" link costs them money on every sale the site sends, and
  nothing else in the build would ever notice. Checked on the home page and on
  every page carrying the header's Buy book button.
- **The `dist` ceiling.** That is how a silent `prune-dist.mjs` failure surfaces
  as a red test instead of a slow rsync.

### Browser — `tests/browser.test.mjs`

Serves `dist` over http (module scripts and Pagefind do not work from `file://`)
and drives Chromium across seven pages, one of each shape.

- **axe**, serious and critical only — a suite that fails on every minor
  advisory gets muted, and a muted suite protects nothing.
- **Contrast on brand fills, as rendered.** The half of rule 3 a machine can
  judge, and on this brand it earns its place three times over: it caught
  magenta-on-orange at 2.74:1 on the eyebrows, on prose links and on the current
  nav item, each of which looked fine in the source. It walks up to the nearest
  ancestor that actually paints a background, because a transparent element
  inherits the orange ground and measuring against white would miss the bug
  entirely.
- **The navigation with JavaScript off**, including that both pages behind the
  Bookings dropdown are reachable.
- **The tag filter**, including arriving at `/faq/#tag=facilitation` — which is
  where eighteen legacy redirects land.
- **An anchor landing below the sticky header**, because half the menu is one.

In a sandbox whose Chromium revision does not match Playwright's, set
`PLAYWRIGHT_CHROMIUM_PATH`, or let it find `/opt/pw-browsers/chromium`.

### Conformance — `tests/conformance.test.mjs`

Where a rule from AGENTS.md becomes executable. **Every test names the rule it
enforces.** If you add a rule there, either add a test here or write "nobody"
beside it — a rule that sounds enforced and is not costs more than an honest
habit, because it gets assumed.

**Check a test has teeth before trusting it.** Inject a violation, watch it go
red, take it back out. A conformance test that cannot fail is worse than none,
because it reads as protection.

### URLs — `tests/urls.test.mjs`

Rule 2, made to run on every push: all 42 addresses answered, the committed
`.htaccess` matching its generator, and the `[NE]` flag that keeps the tag
fragments intact.

## Rule 5, and its one exemption

Tests select `[data-test]` hooks and `js-*` classes. Never a styling class,
never visible copy — so restyling cannot break a test, and neither can an editor
rewording a heading in Notion.

The contrast test is exempt, **by name**, in a set in the conformance test so
the exemption cannot spread by pattern. Rule 5 exists so that restyling cannot
break a test; that test is *about* the styling, asks "every element carrying a
brand fill", and is supposed to break when a fill changes.

The other half of rule 5 rots silently: a hook renamed in a component leaves a
test selecting nothing, which **passes**. So a second test checks that every
`[data-test]` hook any test selects actually exists in the built HTML.
