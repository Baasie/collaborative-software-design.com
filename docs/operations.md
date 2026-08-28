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
| `KUALO_KNOWN_HOSTS` | yes | `ssh-keyscan -p <port> -H <host>`. |
| `KUALO_SSH_PORT` | no | Defaults to 22. Kualo usually is not 22. |
| `SITE_URL` | no | Only for the check after the deploy. Without it the release ships unverified. |

**`KUALO_PATH` must be absolute.** It is interpolated inside single quotes in a
shell on the host, so `~` is never expanded. A value starting with `~` used to
fail at the very last step with `ln: failed to create symbolic link: No such
file or directory`, after a green build and a complete upload. The workflow
rejects it up front now.

**`KUALO_KNOWN_HOSTS` must not be empty.** The alternative to pinning the key
is `StrictHostKeyChecking=no`, which is how a deploy quietly starts trusting
whatever answers on that address. An empty secret used to give a silent
six-second failure; the workflow now says which secret and what to put in it.

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

## When a deploy fails

**"Cannot reach the host on port N."** Kualo's brute-force protection (cPHulk)
blocks IPs, and a GitHub runner draws its address from a pool shared with
everyone else on Azure, so a deploy can be refused for something another tenant
did. The same commit on the next runner goes straight through. Re-run the job.

This one does not heal on its own: nothing deploys unless there is a diff, so
when a sync's deploy is blocked the content is already committed and every
later sync correctly decides there is nothing to publish. The site stays stale
until somebody re-runs it. `virtualddd.com` automates this in
`retry-blocked-deploy.yml`; this repository does not, yet.

**Verified but stale.** The site is checked a minute after the symlink moves,
not immediately. Apache does not pick the new release up at once: for the best
part of a minute afterwards every address answers 200 from the document root
(measured on virtualddd.com: 105 of 105 sampled URLs, no redirects and no 410s
at all, then entirely correct). That is what `Let the release settle` is for.

## What is still thinner here than on virtualddd.com

Worth knowing before relying on either:

- **`verify:live` checks six addresses**, not the URL contract. Over there it
  samples every URL family from a list of 967 and checks that redirects really
  redirect. Ours would not notice a broken `.htaccess`.
- **No weekly watch.** The URL contract and the certificate both rot without
  anybody touching this repository, and nothing here would see it.
- **No notification.** A deploy that skips, fails or ships is silent. The
  skipping case has already misled once: a green run that deployed nothing.
