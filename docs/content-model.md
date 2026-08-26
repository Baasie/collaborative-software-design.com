# The content model

Everything the site publishes comes from the **Collaborative software design**
teamspace in Notion. There are two shapes, and they are different because Notion
holds them differently.

## Writing. The Dear CoMo letters

**Database:** `Dear CoMo Content`
**Data source id:** `c21ccb43-5f0c-490c-8f81-f5f2794f5322`
**Collection:** `writing` → `src/content/writing/*.md`
**Addresses:** index at `/faq/`, letters at `/dear-como/<slug>/`

| Notion property | Type | Front-matter key | Notes |
|---|---|---|---|
| `Question` | title | `title` | The reader's question. It is the page's h1, because that is the form the column takes. |
| `Category` | select | `section` | `Dear Como` → `dear-como`. **Decides the URL.** |
| `Slug` | text | *the filename* | And therefore the address. Required: a published row without one is reported, not guessed at. |
| `Status` | status | `status` | `Published` and `Done` are live. Anything else is not. |
| `Publish date` | date | `publishDate` | Sorts the index. An undated row sorts last, never first. |
| `Tags` | multi-select | `tags` | Normalised by `src/lib/tags.ts` on the way in. |
| `Featured Image` | file | `featuredImage` | Downloaded next to the entry and optimised at build time. |
| `Meta Description` | text | `metaDescription` | What the card and the search result say. |
| `Focus keyphrase` | text | `focusKeyphrase` | Editorial only; nothing branches on it. |
| `Canonicle URL (optional)` | url | `canonical` | For a piece published elsewhere first. |

### Why the index and the letters are at different addresses

They just are. WordPress put the archive at `/faq/` and the posts under
`/dear-como/`, both addresses are live, and rule 2 does not care that the split
is odd. `INDEX_PATH` and `LETTER_PATH` in `src/lib/collections.ts` are the two
constants, named so nobody has to rediscover this.

### Why one collection and not one per section

`Category` also offers `Article`. Four rows are drafted under it and none is
published, and the live site has no such section.

Two collections looked like the obvious shape and was wrong twice over:

- with nothing published under `Article`, `getCollection('articles')` warns on
  every single build, and a warning that is expected is a warning nobody reads;
- a row that changes `Category` changes **address**. With two collections that
  is one file deleted and another created, in two separate passes, and neither
  pass can see both halves. So the old address breaks silently. With one
  collection it is one file whose `section` line changed, and the run that
  changed it holds both the old section and the new one, so it can emit the
  redirect.

`section` is the one field in the whole schema held as a `z.enum` rather than a
string. Everything else is a label, and a label nobody has seen before should
become a new chip rather than a failed deploy. `section` is not a label. It is
an address, and a value with no page to render at is a bug in the sync's
mapping, never an editorial choice. So the sync reports a published `Article` as
needing a decision rather than inventing `/articles/` for it.

**Adding `/articles/` later** is three edits: `SECTION_OF_CATEGORY` and
`SECTION_PATH` in `scripts/sync-notion.ts`, the `section` enum in
`src/content.config.ts`, and an index page.

## Trainings, child pages, not a database

**Parent page:** `Workshops`, id `2f8a485a-fafc-80c4-8f67-ec6163c1cc6c`
**Collection:** `trainings` → `src/content/trainings/*.md`
**Addresses:** `/training/` and `/training/<slug>/`

There are no properties to read, so everything is recovered from the page's own
structure:

| Front-matter key | Where it comes from |
|---|---|
| `title` | The child page's title. |
| *the filename* | `kebab()` of the title. |
| `format` | The nearest heading above it, "2-day", "1 day or less". |
| `order` | Its position on the Workshops page. **Dragging in Notion re-orders the site.** |
| `teaser` | The `Teaser` section of the body, or the first paragraph of prose if there is none. **The section is then removed from the body**, because the page prints the teaser as its lede and would otherwise open by saying the same thing twice. |
| `featuredImage` | The Notion page's **cover**. |

### Pictures on a workshop page

There is nothing to build and nothing to put in the repository. Both routes
already work:

- **The page cover** becomes `featuredImage`, and the workshop page frames it on
  a white plate beside the booking button. Which is where the live WordPress
  page puts its illustration. One picture per workshop, and it doubles as the
  social card.
- **Any image in the body** is downloaded next to the entry into
  `src/content/trainings/_assets/` and rendered where it sits, at whatever
  width the prose column gives it.

Both are pulled by the sync, committed, and optimised at build time, so the
deploy never reaches out to Notion's expiring file URLs. Add the picture in
Notion and it appears; that is the whole procedure. What does NOT work is
putting it in `src/assets/` and referencing it by slug. The content is
Notion's, and a picture inside a description is content.

One thing to get right in Notion: a cover is cropped to a wide banner by
Notion's own UI but downloaded whole, so give it a picture that reads at
396px wide.

Two of these pages hold an older draft of themselves as a *nested* page. The
converter skips `child_page` blocks, so the draft is not published underneath
the real thing. And a unit test pins that.

The WordPress `/training/` page carried **one** workshop. This one carries five,
because Notion has five. That is the point of moving it.

### This is worse than a database in one specific way

A rename moves an address, and nobody renaming a page in Notion thinks of it as
moving one. The sync tracks it and emits a redirect, so it is handled. But it
is handled rather than prevented.

**If the trainings ever grow a property worth filtering or sorting on**: a
price, a next date, a booking link, a "show on the site" checkbox. The right
answer is to make them a proper database and give the sync a spec, not to encode
more meaning in the body of a page. That is rule 7: the fix is allowed to be on
the Notion side.

## What is deliberately *not* in Notion

The three authors and their bios, the book's URL, the contact address and the
navigation live in `src/lib/seo.ts` and `src/lib/nav.ts`. They are the site's
identity rather than its content, and none is something an editor should be able
to change by accident from a database row.

The Manning URL especially: it carries `a_aid` and `a_bid`, which are the
authors' affiliate identifiers. A "tidier" link costs them the revenue on every
sale the site sends, so two tests pin it.
