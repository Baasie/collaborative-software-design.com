# data/

Committed state. Nothing here is hand-edited except where it says so.

| File | Written by | Hand-edited? |
|---|---|---|
| `live-urls.txt` | a person | **Yes.** Every address the site promises to answer — the 42 the WordPress site served, crawled from its Yoast sitemaps. `npm run check:urls` proves each one is served, redirected once, or `410 Gone` on purpose. |
| `legacy-redirects.csv` | a person | **Yes.** Where the old addresses go: the category archive, the eighteen tag archives, the author archive. |
| `retired-urls.csv` | `scripts/sync-notion.ts` | No. Addresses that moved because a slug changed in Notion. |
| `sync-state.json` | `scripts/sync-notion.ts` | No. What the last sync saw: a slug, Notion's `last_edited_time` and a digest of the body, per row. Committed rather than cached so a rename shows up as a diff and a fresh clone does not re-fetch every body. |
| `sync-alerts.json` | `scripts/sync-notion.ts` | No. What the last run wants a person to decide. Written per section, so a section that is now clean clears its own alerts. |

`public/.htaccess` is generated from the two CSVs by `npm run redirects`.
**Never edit it**; edit the generator or the CSVs. A test fails if the committed
file is not what the generator would write today.

## A note on the first sync

`sync-state.json` does not exist yet, and that is deliberate.

The content under `src/content/` was seeded through an authenticated Notion
session rather than by `scripts/sync-notion.ts`, because the repository needed
real pages to build and test against before a `NOTION_TOKEN` existed. It was
written in the sync's own output format, but it is not *from* the sync.

So there is no state file claiming those bodies are current. The first real
`npm run sync` will therefore re-fetch and re-render every one of them from
Notion, which is exactly what should happen: after that commit, Notion is
demonstrably the source of truth and the digests prove it.

Expect that first sync to produce a visible diff — mostly whitespace, plus the
featured images, which the seeding left out. Two body images are already here,
fetched from the WordPress media library rather than from Notion (Notion's file
URLs are short-lived presigned links, so they cannot be committed from a
transcript). Review the diff once, and it will not happen again.
