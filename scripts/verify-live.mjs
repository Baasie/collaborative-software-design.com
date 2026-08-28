/** Ask the deployed host whether the release actually landed.
 *
 * Two modes, for two different questions.
 *
 * Without `--all`, after every deploy: did this release reach the document
 * root? A deploy that rsyncs successfully and then serves the previous release
 * is the failure that catches — build green, transfer green, site stale. Six
 * addresses is enough for that, and the suite has already run.
 *
 * With `--all`, weekly from watch.yml: is every address the WordPress site
 * answered still answered? That question can only be asked of the real server.
 * The redirects live in `.htaccess`, so a host config change, a restore that
 * drops the file, or a document root pointed somewhere new breaks them without
 * failing a single build, because none of those is a commit.
 *
 * virtualddd.com samples by URL family because its inventory is 967 addresses.
 * Ours is 48. Sampling 48 would be a worse check than reading all of them, so
 * `--all` means all of them, and the rule is one rule: follow the redirects and
 * require a 200 at the end. A legacy address whose rule went missing lands on a
 * 404 and fails here.
 */
import { readFileSync } from 'node:fs';

const site = process.argv[2];
const all = process.argv.includes('--all');
if (!site) {
  console.error('Usage: verify-live.mjs <https://host> [--all]');
  process.exit(1);
}
const base = site.replace(/\/$/, '');

// One of each shape, plus the two addresses that carry the money: the book
// link lives on / and the workshops on /training/.
const MUST_ANSWER = ['/', '/training/', '/faq/', '/facilitation/', '/sitemap-index.xml', '/rss.xml'];

/** The inventory, comments and blanks dropped. */
const inventory = () => readFileSync('data/live-urls.txt', 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const paths = all ? inventory() : MUST_ANSWER;
console.log(`checking ${paths.length} address(es) against ${base}\n`);

// One at a time, with a pause. This runs against shared hosting, and the host
// firewalls an address that asks too fast: half an afternoon of requests from
// one laptop was enough to have it drop connections for minutes.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const problems = [];
for (const path of paths) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    // 410 is a promise too: a retired address says gone rather than 404.
    if (res.ok || res.status === 410) console.log(`  ${res.status} ${path}`);
    else problems.push(`${res.status} ${path}`);
  } catch (e) {
    problems.push(`no answer ${path} (${e.message})`);
  }
  if (all) await sleep(250);
}

if (problems.length) {
  console.error(`\nproblems:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nverify:live: ${problems.length} of ${paths.length} failed on ${base}`);
  process.exit(1);
}
console.log(`\nverify:live: all ${paths.length} addresses answered on ${base}`);
