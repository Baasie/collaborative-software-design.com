# The publishing pipeline

```
Notion  ──sync.yml (hourly)──▶  src/content/*.md  ──deploy.yml──▶  the host
                                     (committed)
```

Two workflows, and the split matters: **the deploy never talks to Notion.** The
content is committed, so a deploy is reproducible from the repository alone, and
a bad afternoon at Notion cannot stop a release.

## sync.yml

Runs hourly, and on demand. It is the only thing that writes `src/content/`.

1. `sync-notion.ts content --write`: the `Dear CoMo Content` database.
2. `sync-notion.ts trainings --write`: the child pages of `Workshops`.
3. `npm run redirects`: because a slug that changed is an address that changed,
   and the redirect must ship in the same commit as the rename.
4. Commit, push, and **call** `deploy.yml` with the sha it just pushed.

That last part is not decoration. A push made with `GITHUB_TOKEN` does not
trigger another workflow, by design. So a sync that only pushed would update
the repository and never the site. And a called workflow runs at the *caller's*
commit by default, which is the one **before** the content; passing `ref` is
what stops the deploy building the site as it was a minute ago.

### Incremental, on purpose

Fetching a page's blocks costs about two seconds. Reading its properties is
nearly free, because they arrive with the list query. So every run re-renders
every entry's front matter, and re-fetches a **body** only when Notion says that
page changed.

`data/sync-state.json` is what makes that possible: per row, the slug, Notion's
`last_edited_time`, and a digest of the body that was written. It is
**committed** rather than cached, so a rename shows up as a diff and a fresh
clone does not re-fetch every body on its first run.

The digest also means an edit made *here* rather than in Notion is noticed and
overwritten. That is rule 1 working as intended.

`--full` ignores the state and re-fetches everything.

## What the sync will not decide for you

Some things are editorial. They land in `data/sync-alerts.json` and in the run
summary under "Needs a person".

| Alert | What happened | Why it is not automatic |
|---|---|---|
| `no-slug` | A row is Published with no Slug | A slug invented here becomes an address, and an address is a promise. |
| `unknown-category` | A row is Published under a Category with no section | Writing it anyway produces a file whose `section` fails the schema, which fails `astro check`, which stops the *whole site* publishing over one row's picker. |
| `unpublished-but-live` | A row stopped being Published, or vanished, but its page is still served | See below. |
| `image-gone` | A picture's source stopped answering | The copy already on disk is kept. Better a slightly old image than a broken one. |
| `bad-url` | A URL property holds something that is not an address | See below. |
| `notion-schema-drift` | A property the sync reads was renamed or retyped | The read silently returns nothing, so every file gets rewritten without that field. This is the net for the time somebody forgets to change the code first. |

### The quarantine, specifically

This is the pattern worth understanding, because it is what keeps a status
change from breaking the web. When a row stops being live:

- its file is **not** deleted,
- its file is **not** rewritten (a sentinel says "leave what is on disk alone"),
- the page keeps being served,
- an alert says which address is now serving unpublished content.

Deleting it would be faster and would break every link anyone ever made to it.

### And URL properties, specifically

Notion's URL property is a text box. It accepts `manning.com` and it accepts
`ask Kenny`, and it says nothing about either. The schema says `.url()`, so a
typo written straight through becomes a file `astro check` rejects. And the
deploy stops at its first step, before the build, with every other page on the
site perfectly fine and none of it able to ship.

`scripts/lib/usable-url.ts` is the gate. A missing scheme is a typing convention
and is repaired, out loud, in the log. Anything else is not an address at all:
the field is left off and an editor is told, because the site now lacks a link
they believe is there and only they know what it should have said.

`tests/unit/usable-url.test.mjs` pins the output against the real schema rather
than trusting the comment.

### Schema drift, and the distinction that makes it usable

A property missing from **every** row is a rename or a deletion, and is
reported. A property missing from **some** rows is an empty cell, and is not.
Most letters have a blank Canonical URL; reporting that every hour would train
everyone to ignore the alert entirely. A unit test pins both halves.

## deploy.yml

On a push to `main`, on a pull request, and when the sync calls it.

1. Print **which commit is being built**. The defect this guards against is
   invisible precisely because nothing ever printed it.
2. Reject a push that hand-edited `src/content/`.
3. `npm test`: types, unit tests, a build, then the blocking suite. Green, or
   the previous release stays live. A stale site is better than a broken one.
4. rsync into a **new release directory**, then move a symlink. Releases are
   atomic: a visitor never meets a half-copied site, and a rollback is one
   `ln -sfn`, not a deploy. Five releases are kept.
5. `verify:live`: ask the host whether the release actually landed. A deploy
   that rsyncs successfully and serves the *previous* release is green all the
   way through and completely wrong.

A pull request gets everything above step 4 and deploys nothing.

## Secrets

| Secret | For |
|---|---|
| `NOTION_TOKEN` | The sync. Read access to the Collaborative software design teamspace. |
| `KUALO_HOST`, `KUALO_USER`, `KUALO_PATH`, `KUALO_SSH_KEY` | The rsync. Without `KUALO_HOST` the deploy builds, tests and stops. Which is a fine state to leave it in until you are ready. |
| `KUALO_KNOWN_HOSTS` | The host's public key. `StrictHostKeyChecking=yes` with a pinned key, not `no`: turning it off to save a secret is how a deploy quietly starts trusting whatever answers on that address. |
| `SITE_URL` | `verify:live`. Optional; without it the deploy says it was not verified. |

Set them with **`./scripts/setup-secrets.sh`**, which prompts for each, generates
the deploy keypair, and runs `ssh-keyscan` for `KUALO_KNOWN_HOSTS`. The two
that are fiddly to get right by pasting. Values go straight to `gh` and never
touch this repository.

**Do not create these with placeholder values to reserve the name.** Both
workflows gate on a secret being *present*, and that is exactly what makes them
skip cleanly while you are still setting up:

- no `NOTION_TOKEN` → the hourly sync skips with a notice. A placeholder makes
  it *fail* every hour instead.
- no `KUALO_HOST` → the deploy builds, tests, and stops. A placeholder points an
  rsync at a machine that is not there.

GitHub has no empty secret, so there is no way to reserve a name without this
cost. The script is the way round it.

## API pacing

Notion allows roughly three requests per second and answers 429 above that.
Every call goes through `api()`, which paces to ~2.9 req/s and retries on 429 or
a transient 5xx with backoff, so a large sync cannot fail halfway for want of
patience.
