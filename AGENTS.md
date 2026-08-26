# AGENTS.md, collaborative-software-design.com

The working brief for this repository. Written for **anyone changing this site:
a person, a coding agent, or the two together**. `CLAUDE.md` points here, so
point your own tool here too if it looks for a different filename.

**[README.md](./README.md) is the front door.** It says what the site publishes,
how to run it, and how somebody helps without touching code. The everyday loop
is *not* editing this repository, and knowing that will save you an hour.

## What this site is

**A book site.** It sells *Collaborative Software Design: How to facilitate
domain modelling decisions* (Manning). The training and the consulting hang off
the book, and Dear CoMo (an advice column for facilitators) sits behind the
FAQ link. The persistent header button is **Buy book**, and it carries affiliate
parameters that are the authors' revenue. See
[docs/migration-inventory.md](docs/migration-inventory.md).

It replaces a WordPress site at the same address. Every one of the 42 addresses
that site answered is served, redirected or Gone here, and `npm run check:urls`
proves it.

## Read this much, at minimum

Each rule says **how we know** it is being kept. That line is not decoration. A
rule with a machine behind it is a constraint; a rule with a person behind it is
a habit, and habits drift silently. Assume nothing is checked unless it says so.

1. **Notion is the source of truth.** Everything under `src/content/` is
   generated and is never hand-edited. Edit Notion, then run the sync.
   *How we know: **machine.** The sync re-fetches any body whose digest changed,
   and `deploy.yml` rejects a push that changes `src/content/` from anyone but
   the sync.*
2. **URLs are promises.** Every address the WordPress site answered is still
   served, redirected exactly once, or returned as `410 Gone` on purpose. Never
   edit `public/.htaccess`; edit its generator. See [docs/urls.md](docs/urls.md).
   *How we know: **machine.** `npm run check:urls` against `dist`, currently
   42/42, plus a test that the committed `.htaccess` is what the generator
   would write today, and a test that the inventory still holds all 42.*
3. **The brand is the fixed point.** Layout, copy, components and structure are
   open to improvement. The colours, the type and the logo are not.
   See [docs/brand-and-code.md](docs/brand-and-code.md).
   *How we know: **machine, mostly.** `conformance.test.mjs` keeps colour and
   font literals out of every component and stylesheet but `tokens.css`, and a
   browser test measures real contrast on every brand fill across seven pages.
   Whether something still **feels** right is a person's judgement.*
4. **Propose options, then ask.** For anything that changes what a visitor sees,
   work out what the page and the Notion data actually do, name the friction,
   offer options with a recommendation, and let the maintainers decide.
   *How we know: **nobody.** No check can see an option you did not offer.*
5. **Tests select `[data-test]` hooks and `js-*` classes only**, never a styling
   class and never visible copy, so restyling a section cannot break them.
   *How we know: **machine.** `conformance.test.mjs` reads the test files and
   fails on a selector naming a class the stylesheets define, with exactly one
   named exemption, the contrast test, which is about the styling and is
   supposed to break when it changes. A second test checks every `[data-test]`
   hook a test selects actually exists in the build, because a renamed hook
   leaves a test selecting nothing, which passes.*
6. **Small steps, section by section.** Improvement is opt-in per section, never
   a big-bang rebuild.
   *How we know: **nobody.** Visible in a diff and nowhere else.*
7. **Improvements can land on either side.** Sometimes the right fix is in the
   Notion schema or the editing workflow rather than in the code. Changing
   Notion is in scope, and adding a field to a database beats encoding more
   meaning in the body of a page.
   *How we know: **n/a.** A permission, not a constraint.*
8. **Feature ideas go to Notion**, not into a file in this repository.
   *How we know: **weakly.** `conformance.test.mjs` fails on a `TODO`/`IDEAS`
   file appearing. It cannot tell whether the idea reached Notion.*

The team is small and time is short. The constraint behind every decision here
is *low ongoing maintenance*.

## The trap in this brand

Worth knowing before you write a line of CSS. The page ground is **orange**
(`#E37B45`) and the brand accent is **magenta** (`#9D0064`). Those two together
measure **2.73:1**.

So brand-coloured text must never sit directly on the page ground. It needs a
white plate under it. This is not a style preference and it is not theoretical,
it has now been caught **four** times by the browser test during this build: on
the eyebrows, on prose links, on the current item in the navigation, and on the
contact section's "or write to `<address>`" line the day that band was moved
from the magenta to the orange.

Three consequences are baked into the CSS, and all three are load-bearing:

- **`.eyebrow` is ink, everywhere.** It is not the brand colour on any ground.
  That is also what the live site does, "Chapter #01", "Discover" and "About"
  all measure black there, in the mono, with no capitals. So the safe colour
  and the faithful colour turn out to be the same one.
- **A section sitting directly on the orange says so**, with `.section--ground`,
  and that modifier makes its prose links ink. It paints nothing; what it
  carries is the constraint. The contact band is the one that needs it today.
- **Detail pages put their content on a paper plate.** That is also what the
  WordPress site does (`#main-content{background-color:#fff}`), so it is
  faithful as well as legible.

## Three tiers, and what each one is for

What blocks a deploy must be about code being wrong, never about somebody's
writing.

| Tier | Runs | Fails the deploy? |
|---|---|---|
| **Blocking**: contracts, URLs, browser behaviour, **conformance** | Every push | Yes |
| **Conformance**: the rules above that a machine can read | Inside the blocking suite | Yes |
| **Content report**: what an editor could improve | Every push | No |

`tests/conformance.test.mjs` is where a rule becomes executable. Every test in
it names the rule it enforces. **If you add a rule here, either add a test there
or write "nobody" beside it**. A rule that sounds enforced and is not costs more
than an honest habit, because it gets assumed.

Check a conformance test has teeth before trusting it: inject a violation, watch
it go red, take it back out. A test that cannot fail is worse than none, because
it reads as protection.

What conformance cannot see is additive bias: a component that should have
reused `LetterCard`, a helper duplicating one in `src/lib/`, a third way to
render a card. Every one is *imported by something*, so every mechanical check
calls it used. It is visible in a diff, by a reader, and nowhere else.

## Where the detail lives

| Read this | Before you |
|---|---|
| [docs/migration-inventory.md](docs/migration-inventory.md) | Touch a URL, or wonder what the old site had |
| [docs/content-model.md](docs/content-model.md) | Add a field, add a collection, or wonder why the trainings are pages and the letters are rows |
| [docs/urls.md](docs/urls.md) | Rename a slug, retire a page, or touch redirects |
| [docs/pipeline.md](docs/pipeline.md) | Change the sync, debug a missing page, or ask why nothing deployed |
| [docs/testing.md](docs/testing.md) | Add or change a test, or find out what one is protecting |
| [docs/brand-and-code.md](docs/brand-and-code.md) | Write CSS or add a component |
| [reference/brand/BRAND.md](reference/brand/BRAND.md) | Question any colour, face or logo. Every value there names its source in the live CSS |
| [data/README.md](data/README.md) | Touch anything in `data/` |

Commands are in the [README](./README.md#commands). What a table has no room for:

- **`npm run build`** also runs `prune-dist.mjs`, which drops the unreferenced
  originals Astro emits alongside its `.webp`. `dist` is asserted under a 50 MB
  ceiling, so a silent prune failure surfaces as a failing test rather than a
  slow rsync.
- **`npm run build`** then runs **`pagefind --site dist`**, which indexes the
  built HTML for `/search/`. It indexes the *output*, so there is no second copy
  to keep in step. But **`astro dev` has no search index**, and `/search/` says
  so rather than looking broken.
- **`npm run redirects`** must be re-run after adding or renaming content. A
  test fails if the committed `.htaccess` is stale. `sync.yml` runs it in the
  same job as the sync, so a rename and its redirect land in one commit.
- **`npm run check:urls`** needs a build first. It checks the rules against
  `dist/`.

## The open decisions

Two, both flagged rather than quietly settled:

1. **The contact form is now a `mailto:`.** The WordPress original posts a form
   (Name, Email, Message, and a training/consulting selector). A static site
   cannot process that, so `ContactSection.astro` sends two pre-filled mailto
   links instead. That is a real downgrade. A mailto exposes the address to
   scrapers and does nothing on a machine with no mail client. If it becomes a
   problem, a hosted form endpoint is the fix, and that component is the only
   place that changes.
2. **`/articles/` does not exist.** Notion's `Category` offers `Article`, four
   rows are drafted under it, and nothing is published. The sync reports a
   published Article as needing a decision rather than inventing an address for
   it. Adding the section is one line in `SECTION_OF_CATEGORY`, one in the
   schema's `section` enum, and a page.

## When something goes wrong

| Symptom | Where to look |
|---|---|
| A letter is published in Notion but not on the site | The **sync** run in GitHub Actions, under "Needs a person": a published row with no Slug, or with a Category the site has no section for |
| A field is quietly missing from every generated file | The `notion-schema-drift` alert, same place. A property the sync reads was renamed or retyped, so the read returns nothing and the run commits without it. Change the code first, then the Notion property |
| An address stopped working | `npm run build && npm run check:urls`. If it passes, the address was never in `data/live-urls.txt`. Which is the bug |
| CI is red on `main` after a content commit | The sync commits and deploys as separate jobs. Check which failed before assuming the content is wrong |
| The site is stale but the runs are green | Check the deploy built the commit you expect. The `What is being built?` step prints it |
| A deploy failed on `Cannot reach the host` | The host's brute-force protection blocked the runner's shared IP. Re-run on another runner |
