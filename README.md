# collaborative-software-design.com

The site for **Collaborative Software Design: How to facilitate domain modelling
decisions** (Manning). The book, the workshops, the consulting, and Dear CoMo.

Built with [Astro](https://astro.build). **Notion is the source of truth**: the
words are written in Notion and pulled in by a sync. Publishing is a thing you
do in Notion, not here.

Replaces a WordPress site at the same address. All 42 addresses that site
answered are served, redirected or Gone here, `npm run check:urls` proves it.

## The everyday loop does not touch this repository

| You want to | Do this |
|---|---|
| Publish a Dear CoMo letter | Set its **Status** to `Published` and give it a **Slug** in the `Dear CoMo Content` database. Live within the hour, at `/dear-como/<slug>/`. |
| Change a workshop description | Edit its page under **Workshops** in Notion. |
| Re-order the workshops | Drag them on the **Workshops** page. The site lists them in that order. |
| Move a workshop between "2-day" and "1 day or less" | Drag it under the other heading. |
| Take a page down | Change its Status. The page keeps being served and the run tells somebody, because an address that has been linked to is not something a status change should silently break. Retiring it properly is a line in `data/legacy-redirects.csv`. |

Nothing under `src/content/` is hand-edited. It is generated, and CI rejects a
push that changes it from anyone but the sync.

## Running it

```bash
npm ci
npm run dev          # http://localhost:4321
npm run build        # + prune-dist + the Pagefind search index
npm test             # types, unit tests, build, and the blocking suite
```

`npm run dev` has **no search index**: Pagefind indexes the built HTML, so
`/search/` says so rather than looking broken. Use `npm run build && npm run
preview` to try it.

The browser tests need Chromium: `npx playwright install chromium`.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server. |
| `npm run build` | Build, prune the unreferenced image originals, then build the search index. |
| `npm test` | `astro check`, unit tests, a build, then the blocking suite. What CI gates the deploy on. |
| `npm run test:unit` | The pure-logic tests. Fast, no build. |
| `npm run test:quick` | Unit tests plus the build and URL suites. |
| `npm run sync` | Pull everything from Notion into `src/content/`. Needs `NOTION_TOKEN`. |
| `npm run sync:writing` | Just the Dear CoMo letters. |
| `npm run sync:trainings` | Just the workshops. |
| `npm run sync:sessions` | Just the scheduled public dates. Run it after the workshops: it checks a date points at a workshop that exists. |
| `npm run redirects` | Regenerate `public/.htaccess`. Run after adding or renaming content. |
| `npm run check:urls` | Prove every address in `data/live-urls.txt` is still answered. Needs a build first. |
| `npm run verify:live <url>` | Ask the deployed host whether the release actually landed. |

Add `--full` to a sync to ignore `data/sync-state.json` and re-fetch every body.
Without `--write`, a sync writes to `preview/` so you can look before it lands.

### The Notion token

`scripts/sync-notion.ts` reads `NOTION_TOKEN` from `local.env` (git-ignored):

```
NOTION_TOKEN=ntn_...
```

The integration needs read access to the **Collaborative software design**
teamspace. In CI it is the `NOTION_TOKEN` repository secret.

### Setting up CI

```bash
./scripts/setup-secrets.sh          # everything
./scripts/setup-secrets.sh notion   # just the Notion token
./scripts/setup-secrets.sh deploy   # just the host
```

Prompts for each value, generates the SSH deploy key, and scans the host's
public key. Values go straight to `gh` and never touch this repository. See
[docs/pipeline.md](docs/pipeline.md) for what each secret is for. And for why
placeholder values are worse than none.

The database and page ids in `scripts/sync-notion.ts` are published on purpose.
They identify a database; they do not grant access to one.

## Where things are

```
src/content/          generated from Notion, never hand-edited
  writing/            the Dear CoMo letters
  trainings/          the workshops (child pages of Notion's Workshops page)
src/pages/            the routes
src/lib/              what more than one page needs; nav.ts is the single menu
src/styles/tokens.css EVERY colour, face and measure. A test keeps literals out of components.
scripts/sync-notion.ts the only writer under src/content/
scripts/lib/          the pure parts of the sync, so they can be unit-tested
data/                 committed state, see data/README.md
reference/            the crawl of the WordPress site: the brand, and its pages
docs/                 see AGENTS.md for which to read when
```

## Contributing

Read **[AGENTS.md](./AGENTS.md)** first. It is the working brief, and it is
tool-neutral on purpose. A person, a coding agent, or the two together. It also
carries the one thing worth knowing before writing any CSS: magenta on the
orange ground is 2.73:1, and the site is built around not doing that.

## Licence

Code is [MIT](./LICENSE). The words and images are © their authors; see
[LICENSE-CONTENT](./LICENSE-CONTENT).
