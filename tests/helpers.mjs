/** Shared reading helpers for the build tests. Everything reads `dist`, so the
 *  suite checks what actually ships rather than what a component was supposed
 *  to render. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const DIST = 'dist';

export function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

export const htmlFiles = () => walk(DIST).filter((f) => f.endsWith('.html'));
export const read = (f) => readFileSync(f, 'utf8');

/** The site-relative address a built file is served at. */
export function urlOf(file) {
  const rel = file.slice(DIST.length);
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
}

export const dirSize = (dir) => walk(dir).reduce((n, f) => n + statSync(f).size, 0);
