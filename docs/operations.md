# Running the live site

The host, the deploy, the cutover, and rolling back. Read this before deploying
by hand, cutting a domain over, or rolling back.

Part of the working brief: [AGENTS.md](../AGENTS.md) is the map.

Most of what follows is ported from `virtualddd.com`, which has been deploying
to this same Kualo host since 28 July 2026. Every guard in `deploy.yml` is a
failure that happened there first, and each one is named below.

---

## The shape of a deploy

Atomic. Every release is rsynced into a directory of its own and the document
root is a **symlink**, swapped once the copy is complete. Nobody meets a
half-written site, and a rollback is one command.

```
/home/<user>/collaborative-software-design.com   → ~/releases/collaborative-software-design.com/<sha>
/home/<user>/collaborative-software-design.com.wordpress    the old site, parked
```

The last five releases are kept, so a rollback never needs a rebuild.

**Releases are namespaced by site, and that matters here.** `virtualddd.com`
deploys to the same account and prunes `~/releases/*` on every deploy. An
unnamespaced directory would be deleted by its next deploy, possibly the very
release this site is serving. Both sites keep their own subdirectory.

## The secrets

| Secret | Required | What it is |
|---|---|---|
| `KUALO_HOST` | yes | The SSH host. **Its absence is the gate:** with no value the deploy step skips and the run still reports success. |
| `KUALO_USER` | yes | SSH user, which is the cPanel user. |
| `KUALO_PATH` | yes | The document root, as an **absolute path**. |
| `KUALO_SSH_KEY` | yes | The private key, whole file, header lines included. |
| `KUALO_SSH_PORT` | no | Defaults to 22. Kualo usually is not 22. |
| `SITE_URL` | no | Only for the check after the deploy. Without it the release ships unverified. |

**`KUALO_PATH` must be absolute.** It is interpolated inside single quotes in a
shell on the host, so `~` is never expanded. A value starting with `~` used to
fail at the very last step with `ln: failed to create symbolic link: No such
file or directory`, after a green build and a complete upload. The workflow
rejects it up front now.

**There is no `KUALO_KNOWN_HOSTS`, and that is a decision rather than an
oversight.** The host key is taken fresh with `ssh-keyscan` on every run, the
same as `virtualddd.com`. This repository pinned it in a secret until 28 August
and then deliberately stopped.

Be clear about what the two do. A fresh keyscan is trust on first use, every
run: the key arrives over the same connection somebody would have to control
to impersonate the host, so it is not a defence against a
machine-in-the-middle. Pinning is.

What is at stake is small, which is why the trade is worth taking. SSH binds
the client's signature to the session and the session hash covers the server's
host key, so an impostor cannot forward this deploy's authentication to the
real host: **the deploy key cannot be captured or replayed.** What an impostor
would get is a copy of `dist/`, which is a public website, and production would
silently not update, which the verification a minute later catches.

What pinning costs is availability. The day the host rotates its key, every
deploy fails until somebody regenerates the secret, and the failure reads as a
network problem rather than as what it is.

## Counting page views

Plausible, and only in a production build. Two repository **variables**, not
secrets, because both end up in the page source:

| Variable | Value |
|---|---|
| `PUBLIC_ANALYTICS_SRC` | `https://plausible.io/js/script.js` |
| `PUBLIC_ANALYTICS_DOMAIN` | `collaborative-software-design.com` |

`BaseLayout` emits the tag only when **both** are set and only under
`import.meta.env.PROD`, so a fork, a local build and a pull request are silent
rather than polluting the real numbers. `deploy.yml` passes them to the step
that builds, which here is `Test`, because `npm test` is what produces `dist`.

The script URL is a variable rather than a constant because Plausible's hosted
and self-hosted builds serve the identical tag from different hosts. Moving the
analytics onto our own machine later is one value, not a re-instrumentation.

It sets no cookie and creates no cross-site identifier, which is what lets
`/privacy-policy/` say there is nothing here needing a consent banner. That
page has to keep being able to say that: anything that changes it is a change
to the policy first.

## Cutting the domain over

**CI will not touch a document root that is a real directory.** It checks and
fails rather than deleting anything, because a real directory there is the
WordPress site. Switching over is a deliberate, one-time human step.

```bash
# 1. Back WordPress up first, in cPanel, and take the backup off the host.

# 2. Find the real docroot and check whether virtualddd shares this account.
echo $HOME
ls -d ~/*/ ; ls ~/releases 2>/dev/null

# 3. Move WordPress aside. The document root now does not exist, which is the
#    state the deploy needs: the guard only refuses to replace a REAL
#    directory, and it creates the symlink itself when there is nothing there.
mv ~/collaborative-software-design.com ~/collaborative-software-design.com.wordpress

# 4. Run the deploy. It lands the release and points the document root at it.
#    The site is down between 3 and 4, so keep the gap short.

# 5. Purge the LiteSpeed cache in cPanel, or the old pages keep answering.

# To avoid any gap at all, stage a release first: set KUALO_PATH to a scratch
# path that does not exist (~/staging.csd), run the deploy, then do 3 and point
# the real document root at the release it made, and set KUALO_PATH back.
ln -sfn ~/releases/collaborative-software-design.com/<sha> ~/collaborative-software-design.com
```

**Do not delete the parked WordPress directory** on the strength of the site
looking fine. Its `wp-content/uploads` is what the old media URLs point at, and
things outside this repository still reference them.

## Rolling back

```bash
ls -1dt ~/releases/collaborative-software-design.com/*/     # newest first
ln -sfn ~/releases/collaborative-software-design.com/<older-sha> ~/collaborative-software-design.com
```

No deploy, no rebuild. Then purge the LiteSpeed cache.

## Watching it, once a week

`watch.yml`, Mondays at 06:40. It asks the live server the two questions the
build cannot:

- **Is every inherited address still answered?** `verify:live --all` reads all
  48 entries in `data/live-urls.txt`, follows redirects and requires a 200 or a
  410 at the end. The redirects live in `public/.htaccess`, which only the real
  server executes, so a host config change, a restore that drops the file or a
  document root pointed somewhere new breaks them without failing any build.
- **How long has the certificate got?** Under 21 days fails the run, which is
  two renewal attempts' worth of warning. Renewal is somebody else's
  automation, and its failure mode is silence until the day it expires.

Weekly rather than daily because 48 requests is a real load on shared hosting
and neither failure is one you would fix within the hour. There is no
notification step: a failed scheduled run emails the account that owns the
repository, and a weekly "still fine" is a message people learn to skip.

## What is synced, and when

| | When | What |
|---|---|---|
| Hourly sync | :17, late by 2 to 20 minutes | Incremental. Asks Notion what changed and believes the answer. |
| Nightly sync | 02:43 | `--full`. Every body re-fetched, `data/sync-state.json` ignored. |
| Daily rebuild | 03:20 | No sync. Rebuilds so an expired public date leaves the site. |

The nightly full pass exists because some changes do not register as an edit to
the page that carries them. A picture replaced in place is the one that has
already happened here, and an incremental sync can be correct while the site is
still behind. It deploys nothing unless it produced a diff, so the cost is a
few minutes of CI.

It runs at 02:43 rather than nearer the rebuild on purpose: a full sync that
finds something deploys, and 37 minutes is enough for that deploy to finish
before 03:20 asks for another.

## When a deploy fails

**"Cannot reach the host on port N."** Kualo's brute-force protection (cPHulk)
blocks IPs, and a GitHub runner draws its address from a pool shared with
everyone else on Azure, so a deploy can be refused for something another tenant
did. The same commit on the next runner goes straight through. Re-run the job.

This one does not heal on its own: nothing deploys unless there is a diff, so
when a sync's deploy is blocked the content is already committed and every
later sync correctly decides there is nothing to publish. The site would stay
stale until somebody re-ran it.

`retry-blocked-deploy.yml` does that re-run, once, and only for this. It reads
the failure **annotation**, never the log, because the step prints its own
script first and the log therefore contains the text of every error message in
it whether or not it fired. And it matches on the word `Retryable:`, which
`deploy.yml` writes into exactly two error lines: the probe timing out, and
ssh timing out between the key scan and the session. Matching on ssh's exit
code would be wrong, and it is worth knowing why: **255 is a lockout, a key
nobody authorised, and a wrong user alike**, and two of those three fail
identically on every runner there is.

On 28 August, the day this site went live, three of seven attempts were
refused and the same commit went through on the next runner.

**Verified but stale.** The site is checked a minute after the symlink moves,
not immediately. Apache does not pick the new release up at once: for the best
part of a minute afterwards every address answers 200 from the document root
(measured on virtualddd.com: 105 of 105 sampled URLs, no redirects and no 410s
at all, then entirely correct). That is what `Let the release settle` is for.

## What is still thinner here than on virtualddd.com

Worth knowing before relying on either:

- **No notification.** A deploy that skips, fails or ships is silent, and the
  skipping case has already misled once: a green run that deployed nothing.
  virtualddd.com posts to n8n; this site has nowhere to post to yet. A failed
  scheduled run does email the account, which is what `watch.yml` relies on.
- **No `review.yml`.** Over there, every push touching `src/`, `scripts/`,
  `tests/` or the workflows is read against the brief by a language model, for
  the half a test cannot see. It never blocks publishing. It needs an
  `ANTHROPIC_API_KEY` and bills per push, so it is a spending decision rather
  than a technical one.
- **No `refresh-feed.yml`**, which is theirs alone: their home page fetches
  Bluesky at build time and goes stale between deploys. Nothing here does.
