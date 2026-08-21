/** Ask the deployed host whether the release actually landed.
 *
 * A deploy that rsyncs successfully and serves the previous release is the
 * failure this catches: the build was green, the transfer was green, and the
 * site is stale. Run by deploy.yml after the rsync.
 *
 * Deliberately small. Anything more belongs in the test suite, which runs
 * before the deploy rather than after it.
 */
const site = process.argv[2];
if (!site) {
  console.error('Usage: verify-live.mjs <https://host>');
  process.exit(1);
}
const base = site.replace(/\/$/, '');

// One of each shape, plus the two addresses that carry the money: the book
// link lives on / and the workshops on /training/.
const MUST_ANSWER = ['/', '/training/', '/faq/', '/facilitation/', '/sitemap-index.xml', '/rss.xml'];

let failed = 0;
for (const path of MUST_ANSWER) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) { console.error(`  ! ${url} answered ${res.status}`); failed += 1; }
    else console.log(`  ok ${url}`);
  } catch (e) {
    console.error(`  ! ${url} did not answer: ${e.message}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`verify:live: ${failed} address(es) failed on ${base}`);
  process.exit(1);
}
console.log(`verify:live: ${MUST_ANSWER.length} addresses answered on ${base}`);
