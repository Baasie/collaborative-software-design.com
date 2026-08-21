/** Drop the unreferenced originals Astro emits alongside its optimised images.
 *
 * Nothing links to them, but they still travel in every deploy. `dist` is
 * asserted under a size ceiling by the build test, so a silent failure here
 * surfaces as a failing test rather than as a slow rsync.
 */
import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';
const ASTRO = join(DIST, '_astro');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

let assets;
try { assets = readdirSync(ASTRO); } catch { process.exit(0); }

// What the built output actually mentions. Reading the HTML (and the CSS, and
// the JSON Pagefind writes) rather than guessing from extensions: a file is
// unreferenced only if nothing names it.
const text = walk(DIST)
  .filter((f) => ['.html', '.css', '.js', '.xml', '.txt', '.json', '.md'].includes(extname(f)))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const KEEP = new Set(['.webp', '.css', '.js', '.svg']);
let dropped = 0, bytes = 0;
for (const name of assets) {
  if (KEEP.has(extname(name))) continue;
  if (text.includes(name)) continue;
  const path = join(ASTRO, name);
  bytes += statSync(path).size;
  unlinkSync(path);
  dropped += 1;
}
console.log(`prune-dist: removed ${dropped} unreferenced original(s), ${(bytes / 1e6).toFixed(1)} MB`);
