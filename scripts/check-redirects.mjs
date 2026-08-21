/** Prove every address in data/live-urls.txt is still answered.
 *
 * Three acceptable answers, and no fourth:
 *   served      dist/<path>/index.html exists
 *   redirected  public/.htaccess sends it somewhere, in exactly one hop, and
 *               the destination is itself served
 *   gone        public/.htaccess returns 410 on purpose
 *
 * Anything else is an address the WordPress site answered and this one does
 * not, which is the failure this whole file exists to make impossible to ship.
 * Needs a build first: it checks the rules against the pages in `dist/`.
 */
import { existsSync, readFileSync } from 'node:fs';

const urls = readFileSync('data/live-urls.txt', 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

if (!existsSync('dist')) {
  console.error('check:urls needs a build first — run `npm run build`.');
  process.exit(1);
}

const htaccess = existsSync('public/.htaccess') ? readFileSync('public/.htaccess', 'utf8') : '';
const redirects = new Map();
const gone = new Set();
for (const line of htaccess.split('\n')) {
  const move = line.match(/^\s*RewriteRule\s+"\^(.+?)\$"\s+"(.+?)"\s+\[R=301/);
  if (move) redirects.set('/' + move[1].replace(/\\/g, ''), move[2]);
  const g = line.match(/^\s*RewriteRule\s+"\^(.+?)\$"\s+-\s+\[G,L\]/);
  if (g) gone.add('/' + g[1].replace(/\\/g, ''));
}

// A fragment is a client-side concern; the server only ever sees the path.
const served = (url) => {
  const path = url.split('#')[0];
  return existsSync(`dist${path}index.html`) || existsSync(`dist${path.replace(/\/$/, '')}`);
};

const failures = [];
let ok = 0;
for (const url of urls) {
  if (served(url)) { ok += 1; continue; }
  if (gone.has(url)) { ok += 1; continue; }
  const to = redirects.get(url);
  if (to) {
    const target = to.split('#')[0];
    if (redirects.has(target)) failures.push(`${url} redirects to ${to}, which redirects again (two hops)`);
    else if (!/^https?:\/\//.test(to) && !served(to)) failures.push(`${url} redirects to ${to}, which is not served`);
    else ok += 1;
    continue;
  }
  failures.push(`${url} is not served, not redirected and not Gone`);
}

console.log(`check:urls: ${ok}/${urls.length} addresses answered`);
for (const f of failures) console.error(`  ! ${f}`);
if (failures.length) process.exit(1);
