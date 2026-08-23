/**
 * Notion → src/content/. The script the whole publishing loop rests on.
 *
 *   content     the Dear CoMo letters, to markdown
 *   trainings   the workshops, to markdown
 *
 * Nothing here is hand-edited afterwards: Notion is the source of truth and
 * this is the only writer. Add --write to land files under src/content/;
 * without it everything goes to a preview directory instead.
 *
 * See docs/content-model.md and docs/pipeline.md.
 */
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { normaliseTags } from '../src/lib/tags';
import {
  createBlocksToMd, assetRefs, fileUrl, imageExt, isAssetFor, kebab, plainTitle,
  statusOf, teaserOf, withoutTeaser, yamlList, yamlStr,
  type AssetCtx, type StatusKind,
} from './lib/notion-md';
// Whether Notion is still shaped the way the readers below assume. Every typed
// reader goes through `watch.note`, so the run knows what it depended on.
import { schemaWatch, driftAlerts, driftLines, type Reader } from './lib/schema-drift';
import { usableUrl } from './lib/usable-url';

dotenv.config({ path: 'local.env' });

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error('NOTION_TOKEN missing (expected in local.env, or as a repository secret in CI).');
  process.exit(1);
}
const notion = new Client({ auth: token });

// --- what we read -----------------------------------------------------------
//
// Published on purpose. These identify a database or a page; they do not grant
// access to one. Reading anything needs NOTION_TOKEN, which is a repository
// secret and is not in this repository.

/** `Dear CoMo Content`, in the Collaborative software design teamspace. */
const CONTENT_DS = 'c21ccb43-5f0c-490c-8f81-f5f2794f5322';

/** The `Workshops` page. Its child pages are the trainings, and the headings
 *  between them ("2-day", "1 day or less") are the formats. A *page* and not a
 *  database, which is why the trainings command is its own thing: there are no
 *  properties to read, so the title, the order and the grouping all have to be
 *  recovered from the page's own structure. */
const WORKSHOPS_PAGE = '2f8a485a-fafc-80c4-8f67-ec6163c1cc6c';

// --- API pacing -------------------------------------------------------------
// Notion allows roughly three requests per second and answers 429 above that.
// Every call goes through `api()`, which paces requests and retries on 429 or a
// transient 5xx, so a large sync cannot fail halfway for want of patience.

const MIN_INTERVAL_MS = 340; // ≈ 2.9 req/s
let nextSlot = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(label: string, fn: () => Promise<T>, attempt = 0): Promise<T> {
  const wait = Math.max(0, nextSlot - Date.now());
  if (wait) await sleep(wait);
  nextSlot = Date.now() + MIN_INTERVAL_MS;
  try {
    return await fn();
  } catch (e: any) {
    const status = e?.status ?? e?.code;
    const retriable = status === 429 || status === 502 || status === 503 || status === 504 ||
      e?.code === 'notionhq_client_request_timeout';
    if (!retriable || attempt >= 4) throw e;
    const retryAfter = Number(e?.headers?.['retry-after'] ?? 0);
    const backoff = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    console.warn(`  … ${label} got ${status}; retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt + 2}/5)`);
    await sleep(backoff);
    return api(label, fn, attempt + 1);
  }
}

/** Every row of a data source, paged. */
async function queryAll(dataSourceId: string): Promise<any[]> {
  const rows: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await api('query', () => (notion as any).dataSources.query({
      data_source_id: dataSourceId, page_size: 100, start_cursor: cursor,
    }));
    rows.push(...res.results);
    cursor = res.has_more ? (res.next_cursor as string) : undefined;
  } while (cursor);
  return rows;
}

/** Every child block of a block or page, paged. */
async function childrenOf(blockId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await api('children', () => notion.blocks.children.list({
      block_id: blockId, page_size: 100, start_cursor: cursor,
    }));
    out.push(...res.results);
    cursor = res.has_more ? (res.next_cursor as string) : undefined;
  } while (cursor);
  return out;
}

// --- what the last sync saw -------------------------------------------------
//
// Fetching a page's blocks costs about two seconds; reading its properties is
// nearly free, because they arrive with the list query. So a sync re-renders
// every entry's front matter every time and re-fetches a *body* only when
// Notion says that page changed.
//
// The state is committed rather than cached: it makes a rename visible as a
// diff, and it means a fresh clone does not re-fetch every body on its first run.

const STATE_FILE = 'data/sync-state.json';

interface EntryState {
  slug: string;
  /** Notion's `last_edited_time` when we last rendered this body. */
  edited?: string;
  /** Digest of the body we wrote, so an edit made here rather than in Notion is
   *  noticed and overwritten rather than silently kept. */
  digest?: string;
}

const digestOf = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

type SyncState = Record<string, Record<string, EntryState>>;

function loadState(): SyncState {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

/** Sorted at both levels, because JSON key order is insertion order and the
 *  order Notion returns rows in is not stable — an unsorted file produces a
 *  diff on every run that says nothing. */
function saveState(state: SyncState) {
  const sorted: SyncState = {};
  for (const section of Object.keys(state).sort()) {
    sorted[section] = {};
    for (const id of Object.keys(state[section]).sort()) sorted[section][id] = state[section][id];
  }
  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

// --- what a person has to decide --------------------------------------------

const ALERTS_FILE = 'data/sync-alerts.json';

interface Alert { kind: string; title: string; detail?: string; url?: string }

/** What the run wants a human to look at.
 *
 * Written per section rather than appended, so a section that is now clean
 * clears its own alerts instead of leaving yesterday's on the board. */
function writeAlert(section: string, items: Alert[]) {
  let all: Record<string, Alert[]> = {};
  try { all = JSON.parse(readFileSync(ALERTS_FILE, 'utf8')); } catch { /* first run */ }
  if (items.length) all[section] = items; else delete all[section];
  mkdirSync('data', { recursive: true });
  const sorted: Record<string, Alert[]> = {};
  for (const k of Object.keys(all).sort()) sorted[k] = all[k];
  writeFileSync(ALERTS_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

// --- addresses that moved ----------------------------------------------------

const REDIRECTS_FILE = 'data/retired-urls.csv';

interface RedirectRule { from: string; to: string; why: string }

/** Record a moved address, so `npm run redirects` can serve it.
 *
 * A slug that changes is an *address* that changes, and the run that renames a
 * page is the only thing that ever holds both the old name and the new one. */
export function recordRedirects(rules: RedirectRule[]) {
  if (!rules.length) return;
  const rows = new Map<string, RedirectRule>();
  try {
    const csv = readFileSync(REDIRECTS_FILE, 'utf8').trim().split('\n').slice(1);
    for (const line of csv) {
      const [from, to, ...why] = line.split(',');
      if (from) rows.set(from, { from, to: to ?? '', why: why.join(',') });
    }
  } catch { /* first run */ }
  // A rule pointing at what has just moved is a second hop. Move it too.
  for (const rule of rules) {
    for (const [from, existing] of rows) {
      if (existing.to === rule.from) rows.set(from, { ...existing, to: rule.to });
    }
    rows.set(rule.from, rule);
  }
  mkdirSync('data', { recursive: true });
  const out = ['from,to,why', ...[...rows.values()]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((r) => `${r.from},${r.to},${r.why.replace(/,/g, ';')}`)];
  writeFileSync(REDIRECTS_FILE, out.join('\n') + '\n');
}

// --- images ------------------------------------------------------------------

const IMG_MAX = 1600;

async function shrinkImage(raw: Buffer, ext: string): Promise<Buffer> {
  if (ext === 'svg' || ext === 'gif') return raw;
  try {
    const img = sharp(raw, { failOn: 'error' });
    const meta = await img.metadata();
    const pipeline = (meta.width ?? 0) > IMG_MAX ? img.resize({ width: IMG_MAX }) : img;
    if (ext === 'png') return await pipeline.png({ compressionLevel: 9 }).toBuffer();
    if (ext === 'webp') return await pipeline.webp({ quality: 82 }).toBuffer();
    return await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch (e) {
    // Never swallow this into `return raw`: that is how an HTML error page gets
    // committed as somebody's photograph, and the build then fails twenty
    // minutes later in a different workflow, naming a file rather than a row.
    console.warn(`  ! could not process image (${ext}): ${(e as Error).message}`);
    throw e;
  }
}

const keptImages: Alert[] = [];
const badUrls: Alert[] = [];

function existingAsset(dir: string, slug: string, label: string): string | null {
  try {
    const hit = readdirSync(dir).find((f) => isAssetFor(f, slug, label));
    return hit ? `./_assets/${hit}` : null;
  } catch { return null; }
}

/** Delete pictures no entry refers to any more. Without this a renamed or
 *  retired page leaves its images in the repository for ever. */
function pruneAssets(outDir: string, label = 'asset'): void {
  const dir = `${outDir}/_assets`;
  let files: string[];
  try { files = readdirSync(dir); } catch { return; }
  const referenced = new Set<string>();
  for (const f of readdirSync(outDir)) {
    if (f === '_assets') continue;
    for (const ref of assetRefs(readFileSync(`${outDir}/${f}`, 'utf8'))) referenced.add(ref);
  }
  let dropped = 0;
  for (const f of files) {
    if (referenced.has(f)) continue;
    unlinkSync(`${dir}/${f}`);
    dropped += 1;
  }
  if (dropped) console.log(`  pruned ${dropped} unreferenced ${label}${dropped === 1 ? '' : 's'}`);
}

async function downloadImage(url: string, ctx: AssetCtx, label: string): Promise<string | null> {
  if (!url) return null;
  const keep = () => {
    const had = existingAsset(`${ctx.dir}/_assets`, ctx.slug, label);
    if (had) {
      keptImages.push({
        kind: 'image-gone', title: ctx.slug,
        detail: `${label}: the source stopped answering; kept the copy already on disk.`,
      });
    }
    return had;
  };
  try {
    const res = await fetch(url);
    if (!res.ok) { console.warn(`  ! image ${res.status} for ${ctx.slug}/${label}`); return keep(); }
    const raw = Buffer.from(await res.arrayBuffer());
    const ext = imageExt(raw);
    if (!ext) { console.warn(`  ! not an image for ${ctx.slug}/${label}`); return keep(); }
    const body = await shrinkImage(raw, ext);
    mkdirSync(`${ctx.dir}/_assets`, { recursive: true });
    // Remove any older extension for the same slug+label, or a JPEG that became
    // a PNG would leave both behind.
    for (const f of readdirSync(`${ctx.dir}/_assets`)) {
      if (isAssetFor(f, ctx.slug, label)) unlinkSync(`${ctx.dir}/_assets/${f}`);
    }
    const name = `${ctx.slug}-${label}.${ext}`;
    writeFileSync(`${ctx.dir}/_assets/${name}`, body);
    return `./_assets/${name}`;
  } catch (e) {
    console.warn(`  ! image failed for ${ctx.slug}/${label}: ${(e as Error).message}`);
    return keep();
  }
}

const { blocksToMd, seenUnhandled } = createBlocksToMd({ childrenOf, downloadImage });

/** The featured image and body of an entry already on disk, so an unchanged
 *  body need not be re-fetched from Notion. */
function readExisting(path: string): { featured?: string; teaser?: string; body: string } | null {
  try {
    const raw = readFileSync(path, 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) return null;
    const featured = m[1].match(/^featuredImage:\s*"(.+)"$/m)?.[1];
    // The teaser has to come back off the FRONTMATTER on the unchanged path,
    // because the body it was extracted from no longer contains it.
    const teaser = m[1].match(/^teaser:\s*"([\s\S]*?)"$/m)?.[1];
    return { featured, teaser, body: m[2].replace(/^\n+/, '') };
  } catch { return null; }
}

// --- the content command: the Dear CoMo letters ------------------------------
//
// One database, one collection, one pass. The database also offers an `Article`
// Category, but nothing is published under it and the site has no section for
// one, so a published Article is reported as needing a decision rather than
// being given an address nobody chose. Adding /articles/ later is one line
// here, one in the schema's `section` enum, and a page.

/** Notion's `Category` → the section the site renders it in. */
const SECTION_OF_CATEGORY: Record<string, string> = {
  'Dear Como': 'dear-como',
};

/** Where each section's letters live. The index is at /faq/ and the letters at
 *  /dear-como/ — both the live site's addresses, not a choice. */
const SECTION_PATH: Record<string, string> = {
  'dear-como': '/dear-como/',
};

const WRITING_DIR = 'writing';

/** A file this run deliberately did not rewrite. See `files` in `runContent`. */
const QUARANTINED = Symbol('quarantined');

/** The statuses that put a row on the site. `Done` counts alongside
 *  `Published`: the board uses it for a letter that has run. */
const LIVE_STATUSES = ['Published', 'Done'];
const STATUS_KIND: StatusKind = 'status';

/** Read a URL property, and never hand the build a value it will refuse. */
function readUrl(prop: string, raw: string | undefined, row: string, page: string) {
  const read = usableUrl(raw);
  if (read.problem === 'repaired') {
    console.warn(`  ~ ${row}: ${prop} "${read.raw}" had no scheme; publishing ${read.url}`);
  } else if (read.problem === 'unusable') {
    badUrls.push({
      kind: 'bad-url', title: row, url: page,
      detail: `${prop} holds "${read.raw}", which is not an address. Left off the page.`,
    });
  }
  return read.url;
}

async function runContent(outRoot: string, write: boolean, full: boolean) {
  const key = 'writing';
  const outDir = `${outRoot}/${WRITING_DIR}`;
  mkdirSync(outDir, { recursive: true });

  const state = loadState();
  const was = state[key] ?? {};
  const now: Record<string, EntryState> = {};

  const watch = schemaWatch();
  const rows = await queryAll(CONTENT_DS);
  console.log(`${key}: ${rows.length} rows in the database`);

  /** filename -> contents, written in one go once every page has rendered, so a
   *  run that dies halfway leaves the last good set on disk rather than a
   *  half-written section. `QUARANTINED` means "this file is spoken for, leave
   *  what is on disk alone". */
  const files = new Map<string, string | typeof QUARANTINED>();

  const noSlug: Alert[] = [];
  const badCategory: Alert[] = [];
  const unpublishedButLive: Alert[] = [];
  const moved: RedirectRule[] = [];

  for (const page of rows) {
    const props = page.properties ?? {};
    const read = (name: string, kind: Reader) => {
      const p = props[name];
      watch.note(name, kind, p);
      return p;
    };
    const text = (n: string) => (read(n, 'rich_text')?.rich_text ?? []).map((t: any) => t.plain_text).join('').trim();
    const select = (n: string) => read(n, 'select')?.select?.name as string | undefined;
    const multi = (n: string) => (read(n, 'multi_select')?.multi_select ?? []).map((o: any) => o.name);
    const date = (n: string) => read(n, 'date')?.date?.start as string | undefined;

    watch.note('Status', 'status', props.Status);
    watch.note('Question', 'title', props.Question);

    const category = select('Category');
    const section = category ? SECTION_OF_CATEGORY[category] : undefined;
    const title = plainTitle(page, 'Question');
    const status = statusOf(page, STATUS_KIND);
    const live = LIVE_STATUSES.includes(status);
    const slug = text('Slug');
    const pageUrl = page.url as string;

    if (!live) {
      // A page that was published and is not any more still has an address
      // people have linked to. Nothing is deleted on a status change: that is
      // an editorial decision, and only a person can make it. So the file stays
      // exactly as it is, the page keeps being served, and somebody is told.
      const before = was[page.id];
      if (before && readExisting(`${outDir}/${before.slug}.md`)) {
        unpublishedButLive.push({
          kind: 'unpublished-but-live', title,
          url: `${SECTION_PATH['dear-como']}${before.slug}/`,
          detail: `Status is now "${status}". The page is still served. Retire it or re-publish it.`,
        });
        now[page.id] = before;
        files.set(`${before.slug}.md`, QUARANTINED);
      }
      continue;
    }

    if (!section) {
      // Published into a Category the site has no section for. Reported rather
      // than guessed at: writing it anyway produces a file whose `section`
      // fails the schema, which fails `astro check`, which stops the whole site
      // publishing over one row's picker.
      badCategory.push({
        kind: 'unknown-category', title, url: pageUrl,
        detail: `Category is ${category ? `"${category}"` : 'empty'}, which is not a section of this site. `
          + `Known: ${Object.keys(SECTION_OF_CATEGORY).join(', ')}. `
          + `Adding one is a line in scripts/sync-notion.ts, the schema's enum, and a page.`,
      });
      continue;
    }

    if (!slug) {
      // Published with nowhere to live. Reported rather than guessed at: a slug
      // invented here becomes an address, and an address is a promise.
      noSlug.push({
        kind: 'no-slug', title, url: pageUrl,
        detail: 'Published, but the Slug property is empty, so there is no address to publish it at.',
      });
      continue;
    }

    const before = was[page.id];
    if (before && before.slug !== slug) {
      moved.push({
        from: `${SECTION_PATH[section]}${before.slug}/`,
        to: `${SECTION_PATH[section]}${slug}/`,
        why: 'slug changed in Notion',
      });
    }

    const path = `${outDir}/${slug}.md`;
    const existing = readExisting(path);
    const edited = page.last_edited_time as string;
    // Re-fetch a body only when Notion says the page changed, or when what is
    // on disk is not what we last wrote — an edit made here rather than in
    // Notion is overwritten, because Notion is the source of truth.
    const unchanged = !full && existing
      && before?.edited === edited
      && before?.digest === digestOf(existing.body);

    const ctx: AssetCtx = { dir: outDir, slug, count: 0 };
    let body: string;
    let featured: string | null | undefined;
    if (unchanged) {
      body = existing!.body;
      featured = existing!.featured;
    } else {
      body = await blocksToMd(await childrenOf(page.id), ctx);
      const img = (read('Featured Image', 'files')?.files ?? [])[0];
      featured = img ? await downloadImage(fileUrl(img), ctx, 'featured') : null;
      process.stdout.write('.');
    }

    const fm: string[] = [
      `title: ${yamlStr(title)}`,
      `section: ${yamlStr(section)}`,
      `status: ${yamlStr(status)}`,
    ];
    const pub = date('Publish date');
    if (pub) fm.push(`publishDate: ${pub.slice(0, 10)}`);
    const tags = normaliseTags(multi('Tags'));
    if (tags.length) fm.push(`tags: ${yamlList(tags)}`);
    if (featured) fm.push(`featuredImage: ${yamlStr(featured)}`);
    const canonical = readUrl('Canonicle URL (optional)', read('Canonicle URL (optional)', 'url')?.url, title, pageUrl);
    if (canonical) fm.push(`canonical: ${yamlStr(canonical)}`);
    const focus = text('Focus keyphrase');
    if (focus) fm.push(`focusKeyphrase: ${yamlStr(focus)}`);
    const meta = text('Meta Description');
    if (meta) fm.push(`metaDescription: ${yamlStr(meta)}`);

    files.set(`${slug}.md`, `---\n${fm.join('\n')}\n---\n\n${body.trim()}\n`);
    now[page.id] = { slug, edited, digest: digestOf(body.trim() + '\n') };
  }
  process.stdout.write('\n');

  // Anything on disk this run did not produce and did not deliberately keep is
  // a page that vanished from Notion without anybody saying so.
  const kept = new Set([...files.keys()]);
  for (const f of readdirSync(outDir).filter((f) => f.endsWith('.md') && !kept.has(f))) {
    const slug = f.replace(/\.md$/, '');
    unpublishedButLive.push({
      kind: 'unpublished-but-live', title: slug,
      url: `${SECTION_PATH['dear-como']}${slug}/`,
      detail: 'The row is gone from Notion. The page is still served; retire it on purpose or restore the row.',
    });
  }

  if (write) {
    for (const [name, contents] of files) {
      if (contents === QUARANTINED) continue;   // keep what is on disk
      writeFileSync(`${outDir}/${name}`, contents);
    }
    pruneAssets(outDir, 'image');
    state[key] = now;
    saveState(state);
    recordRedirects(moved);
    writeAlert(key, [...noSlug, ...badCategory, ...unpublishedButLive, ...keptImages, ...badUrls,
      ...driftAlerts(key, `https://www.notion.so/${CONTENT_DS.replace(/-/g, '')}`, watch.drift())]);
  }

  const written = [...files.values()].filter((v) => v !== QUARANTINED).length;
  console.log(`${key}: ${written} entries ${write ? 'written to' : 'previewed in'} ${outDir}`);
  for (const line of driftLines(watch.drift())) console.warn(`  ! ${line}`);
  if (noSlug.length) console.warn(`  ! ${noSlug.length} published row(s) have no slug`);
  if (badCategory.length) console.warn(`  ! ${badCategory.length} published row(s) have no known Category`);
  if (unpublishedButLive.length) console.warn(`  ! ${unpublishedButLive.length} live address(es) no longer published`);
  if (moved.length) console.warn(`  ~ ${moved.length} address(es) moved; run \`npm run redirects\``);
  return { noSlug, badCategory, unpublishedButLive, moved };
}

// --- the trainings command ---------------------------------------------------
//
// The trainings are child pages of the `Workshops` page rather than rows in a
// database, so there are no properties to read. Everything the site needs is
// recovered from the page's own structure: the title, the nearest heading above
// it (the format), its position (the order), and the `Teaser` section of the
// body.
//
// This is worse than a database in one specific way — a rename moves an
// address, and nobody renaming a page in Notion thinks of it as moving one — so
// the rename tracking below is the same as for the letters. If the trainings
// ever grow a property worth filtering on (a price, a next date, a booking
// link), the right answer is to make them a database, not to encode more of
// them in the body of a page.

async function runTrainings(outRoot: string, write: boolean, full: boolean) {
  const outDir = `${outRoot}/trainings`;
  mkdirSync(outDir, { recursive: true });

  const state = loadState();
  const was = state.trainings ?? {};
  const now: Record<string, EntryState> = {};

  const blocks = await childrenOf(WORKSHOPS_PAGE);
  const files = new Map<string, string>();
  const moved: RedirectRule[] = [];
  const gone: Alert[] = [];

  // The headings on the Workshops page are the formats, and a child page
  // belongs to the last one seen above it. A training dragged out from under
  // every heading gets no format rather than the wrong one.
  let format: string | undefined;
  let order = 0;

  for (const block of blocks) {
    if (block.type === 'heading_2' || block.type === 'heading_3') {
      const label = (block[block.type].rich_text ?? []).map((t: any) => t.plain_text).join('').trim();
      // "Workshop Descriptions" is the page's own title for the list, not a
      // format. Only a heading that actually labels a group is one.
      if (label && !/^workshop descriptions$/i.test(label)) format = label;
      continue;
    }
    if (block.type !== 'child_page') continue;

    const page: any = await api('page', () => notion.pages.retrieve({ page_id: block.id }));
    const title = plainTitle(page, 'title') || (block.child_page?.title ?? '').trim();
    if (!title) continue;
    const slug = kebab(title);
    order += 1;

    const before = was[block.id];
    if (before && before.slug !== slug) {
      moved.push({ from: `/training/${before.slug}/`, to: `/training/${slug}/`, why: 'renamed in Notion' });
    }

    const existing = readExisting(`${outDir}/${slug}.md`);
    const edited = page.last_edited_time as string;
    const unchanged = !full && existing && before?.edited === edited && before?.digest === digestOf(existing.body);

    const ctx: AssetCtx = { dir: outDir, slug, count: 0 };
    let body: string;
    let featured: string | null | undefined;
    let teaser: string | undefined;
    if (unchanged) {
      body = existing!.body;
      featured = existing!.featured;
      teaser = existing!.teaser;
    } else {
      const full = await blocksToMd(await childrenOf(block.id), ctx);
      // Extract first, then strip: the teaser goes in the frontmatter, and the
      // page prints it as the lede, so leaving the section in the body as well
      // would make every workshop open by saying the same thing twice.
      teaser = teaserOf(full);
      body = withoutTeaser(full);
      const cover = page.cover ? fileUrl(page.cover) : '';
      featured = cover ? await downloadImage(cover, ctx, 'featured') : null;
      process.stdout.write('.');
    }

    const fm = [`title: ${yamlStr(title)}`, `order: ${order}`];
    if (format) fm.push(`format: ${yamlStr(format)}`);
    if (teaser) fm.push(`teaser: ${yamlStr(teaser)}`);
    if (featured) fm.push(`featuredImage: ${yamlStr(featured)}`);

    files.set(`${slug}.md`, `---\n${fm.join('\n')}\n---\n\n${body.trim()}\n`);
    now[block.id] = { slug, edited, digest: digestOf(body.trim() + '\n') };
  }
  process.stdout.write('\n');

  const kept = new Set([...files.keys()]);
  for (const f of readdirSync(outDir).filter((f) => f.endsWith('.md') && !kept.has(f))) {
    gone.push({
      kind: 'unpublished-but-live', title: f.replace(/\.md$/, ''),
      url: `/training/${f.replace(/\.md$/, '')}/`,
      detail: 'No longer a child page of Workshops in Notion. The page is still served; retire it on purpose or restore it.',
    });
  }

  if (write) {
    for (const [name, contents] of files) writeFileSync(`${outDir}/${name}`, contents);
    pruneAssets(outDir, 'image');
    state.trainings = now;
    saveState(state);
    recordRedirects(moved);
    writeAlert('trainings', [...gone, ...keptImages, ...badUrls]);
  }

  console.log(`trainings: ${files.size} entries ${write ? 'written to' : 'previewed in'} ${outDir}`);
  if (gone.length) console.warn(`  ! ${gone.length} live training(s) no longer in Notion`);
  if (moved.length) console.warn(`  ~ ${moved.length} address(es) moved; run \`npm run redirects\``);
  return { moved, gone };
}

// --- CLI ---------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];
const write = args.includes('--write');
const full = args.includes('--full');
// Without --write everything goes to a preview directory, so fidelity can be
// inspected before anything lands in src/content/ and in git.
const outRoot = write ? 'src/content' : 'preview';

const run = async () => {
  if (command === 'content') await runContent(outRoot, write, full);
  else if (command === 'trainings') await runTrainings(outRoot, write, full);
  else {
    console.error('Usage: sync-notion.ts <content | trainings> [--write] [--full]');
    process.exit(1);
  }
  if (seenUnhandled.size) {
    // A block type nobody has written a rule for is a silent gap in a page, so
    // it surfaces as a message rather than as missing words.
    console.warn(`  ! unhandled Notion block types: ${[...seenUnhandled].join(', ')}`);
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
