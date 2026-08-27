/** Notion → markdown conversion, with no network and no filesystem.
 *
 * This is the part of the sync that decides what the website actually says, so
 * it lives apart from the API client that feeds it and is covered by
 * `tests/unit/notion-md.test.mjs`. Everything here is either pure or takes its
 * side effects as injected functions.
 *
 * `scripts/sync-notion.ts` owns the Notion client, the rate limiting, the image
 * downloads and the file writing; it imports the rules from here.
 */

/** A file name from a title.
 *
 * Accents are folded rather than dropped, because dropping them mangles a
 * name: `Gáspár Nagy` would become `g-sp-r-nagy`. */
export function kebab(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function plainTitle(page: any, prop: string): string {
  const p = page.properties?.[prop];
  return (p?.title ?? []).map((t: any) => t.plain_text).join('').trim();
}

export type StatusKind = 'select' | 'status';

/** The Status value, from whichever of Notion's two status types is in use. */
export function statusOf(page: any, kind: StatusKind, prop = 'Status'): string {
  const p = page.properties?.[prop];
  return (kind === 'select' ? p?.select?.name : p?.status?.name) ?? '';
}

export function yamlStr(s: string): string {
  return '"' + (s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function yamlList(items: string[]): string {
  return '[' + items.map(yamlStr).join(', ') + ']';
}

export function fileUrl(f: any): string {
  return f?.type === 'external' ? f.external?.url : f?.file?.url ?? '';
}

/** Notion rich text → markdown, carrying annotations and links. */
export function richText(rts: any[] = []): string {
  return rts.map((rt) => {
    let t = rt.plain_text ?? '';
    const a = rt.annotations ?? {};
    if (a.code) t = '`' + t + '`';
    if (a.bold) t = `**${t}**`;
    if (a.italic) t = `*${t}*`;
    if (a.strikethrough) t = `~~${t}~~`;
    let href = rt.href ?? rt.text?.link?.url;
    // A Notion mention links to a bare page id ("/e342ff0d…"), which is not a
    // URL on this site. Where the visible text is itself a URL, use that;
    // otherwise keep the text and drop the dead link.
    if (href && /^\/?[0-9a-f]{32}$/.test(href.replace(/^\//, ''))) {
      href = /^https?:\/\//.test(t) ? t : undefined;
    }
    if (href) t = `[${t}](${href})`;
    return t;
  }).join('');
}

export interface AssetCtx { dir: string; slug: string; count: number }

/** Every `_assets/…` file an entry refers to.
 *
 * Reads the written entry rather than the run's own bookkeeping, because a
 * sync is incremental: most entries are not re-rendered, and their pictures are
 * just as referenced as the ones that were. */
export function assetRefs(entry: string): string[] {
  return [...entry.matchAll(/_assets\/([^)"'\s]+)/g)]
    .map((m) => { try { return decodeURIComponent(m[1]); } catch { return m[1]; } });
}

/** What the bytes actually are, whatever the URL and the headers claimed.
 *
 * Trusting the extension is how an HTML error page gets committed as somebody's
 * photograph: a file property that *links to* a document elsewhere can answer
 * with a viewer page, 74 KB of HTML, 200 OK, at an address ending `.png`. The
 * bytes are the one thing that cannot lie, so they decide both whether this is
 * an image at all and what to call it. */
export function imageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF'
    && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  // AVIF carries its brand at bytes 8..12 of an ISO base media container.
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  // SVG is text and has no magic number, so the test is that the document
  // *opens* as one. A web page with a logo inside it is not an image.
  const head = buf.subarray(0, 512).toString('utf8').replace(/^﻿/, '').trimStart();
  if (head.startsWith('<svg')) return 'svg';
  if (head.startsWith('<?xml') && /<svg[\s>]/.test(head)) return 'svg';
  return null;
}

/** Is this file the asset a previous sync stored for `slug` and `label`?
 *
 * Assets are written as `<slug>-<label>.<ext>`. What makes it subtle is names
 * shadowing each other: `body-1` must not answer for `body-11`, and a slug that
 * is the prefix of another must not lend it its picture. Only the extension may
 * follow the label. */
export function isAssetFor(file: string, slug: string, label: string): boolean {
  const stem = `${slug}-${label}.`;
  return file.startsWith(stem) && /^[a-z0-9]+$/i.test(file.slice(stem.length));
}

export interface MdDeps {
  /** Fetch a block's children. The script supplies the paged API call. */
  childrenOf: (blockId: string) => Promise<any[]>;
  /** Store an image and return the path to reference, or null to drop it. */
  downloadImage: (url: string, ctx: AssetCtx, label: string) => Promise<string | null>;
}

/** Build a `blocksToMd` bound to the given side effects.
 *
 * Returns the converter plus `seenUnhandled`, the set of Notion block types the
 * run met and had no rule for, reported at the end of a sync so a new block
 * type surfaces as a message rather than as a silent gap in a page. */
export function createBlocksToMd(deps: MdDeps) {
  const seenUnhandled = new Set<string>();

  const NOTION_HEADING = { heading_1: 1, heading_2: 2, heading_3: 3 } as const;

  const hasText = (b: any) =>
    (b[b.type]?.rich_text ?? []).some((t: any) => (t.plain_text ?? '').trim());

  /** How far this document's headings must move so its shallowest becomes an
   *  h2, sitting under the page title's h1.
   *
   * Demoting everything by one is right only for a body that starts with a
   * heading_1. Most do not: an author who opens with heading_2 would produce a
   * page whose first heading is an h3, which tells a screen reader about a
   * level that is not there. Shifting by the distance to h2 handles every case. */
  const headingShift = (blocks: any[]) => {
    const levels = blocks
      // An empty heading is dropped below, so it must not get a vote on where
      // the rest of the document sits either.
      .filter(hasText)
      .map((b) => NOTION_HEADING[b.type as keyof typeof NOTION_HEADING])
      .filter((n) => n !== undefined) as number[];
    return levels.length ? 2 - Math.min(...levels) : 0;
  };

  async function blocksToMd(blocks: any[], ctx: AssetCtx | null, indent = '', shift?: number): Promise<string> {
    const out: string[] = [];
    const move = shift ?? headingShift(blocks);
    // An empty heading is a formatting artifact, not content: Notion leaves one
    // behind whenever somebody presses `##` and changes their mind, and two of
    // the workshop pages carry one. Rendered, it is an empty `<h2></h2>`, an
    // axe violation, and a heading a screen reader announces with nothing in
    // it. Dropped rather than rendered.
    const heading = (level: number, rt: any[]) => {
      const text = richText(rt).trim();
      return text ? `${'#'.repeat(Math.min(6, Math.max(2, level + move)))} ${text}` : '';
    };
    let numIdx = 0;
    for (const b of blocks) {
      const t = b.type;
      if (t !== 'numbered_list_item') numIdx = 0;
      const data = b[t];
      const kids = b.has_children ? await deps.childrenOf(b.id) : [];
      const nestable = ['paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'callout', 'toggle'].includes(t);
      const nested = kids.length && nestable ? '\n' + (await blocksToMd(kids, ctx, indent + '  ', move)) : '';

      switch (t) {
        case 'paragraph': out.push(indent + richText(data.rich_text) + nested); break;
        // Never an h1: the page title is the only one. See `headingShift`.
        case 'heading_1': out.push(heading(1, data.rich_text)); break;
        case 'heading_2': out.push(heading(2, data.rich_text)); break;
        case 'heading_3': out.push(heading(3, data.rich_text)); break;
        case 'bulleted_list_item': out.push(`${indent}- ${richText(data.rich_text)}${nested}`); break;
        case 'numbered_list_item': out.push(`${indent}${++numIdx}. ${richText(data.rich_text)}${nested}`); break;
        case 'to_do': out.push(`${indent}- [${data.checked ? 'x' : ' '}] ${richText(data.rich_text)}${nested}`); break;
        case 'quote': out.push(`> ${richText(data.rich_text)}`); break;
        case 'callout': {
          const icon = data.icon?.emoji ? data.icon.emoji + ' ' : '';
          out.push(`> ${icon}${richText(data.rich_text)}${nested ? '\n' + nested : ''}`); break;
        }
        case 'code': out.push('```' + (data.language ?? '') + '\n' + richText(data.rich_text) + '\n```'); break;
        case 'divider': out.push('---'); break;
        // Notion's columns, which the workshop pages use in the three places
        // the live WordPress page splits into two: the About text, the What
        // you will learn list, and Before the workshop beside Audience.
        //
        // Markdown has no columns, so this emits the wrappers as HTML. Each
        // tag sits alone with a blank line around it, which is what keeps the
        // content between them MARKDOWN: a CommonMark HTML block ends at a
        // blank line, so everything after one is parsed normally again. Written
        // any tighter and the whole column would ship as literal text.
        //
        // The track widths come from Notion's own ratios, so dragging a column
        // divider in Notion changes the page. A column with no ratio falls back
        // to an equal share.
        case 'column_list': {
          const cols = kids.filter((k: any) => k.type === 'column');
          if (!cols.length) break;
          const tracks = cols
            .map((c: any) => `${Math.round((c.column?.width_ratio ?? 1 / cols.length) * 100)}fr`)
            .join(' ');
          const parts: string[] = [];
          for (const col of cols) {
            const inner = await blocksToMd(await deps.childrenOf(col.id), ctx, '', move);
            parts.push(`<div class="col">\n\n${inner.trim()}\n\n</div>`);
          }
          out.push(`<div class="cols" style="--tracks: ${tracks}">\n\n${parts.join('\n\n')}\n\n</div>`);
          break;
        }
        // Reached only when a column is met outside its list, which does not
        // happen: `column_list` reads its own children.
        case 'column': break;
        case 'image': {
          const url = fileUrl(data); const cap = richText(data.caption);
          let rel: string | null = url;
          if (url && ctx) rel = await deps.downloadImage(url, ctx, `body-${++ctx.count}`);
          out.push(rel ? `![${cap}](${rel})` : ''); break;
        }
        case 'video': case 'embed': case 'bookmark': case 'link_preview': {
          const url = data.url ?? fileUrl(data);
          out.push(url ? `[${url}](${url})` : ''); break;
        }
        case 'toggle':
          out.push(`<details><summary>${richText(data.rich_text)}</summary>\n\n${nested}\n</details>`); break;
        case 'table': {
          const rows = kids.filter((k) => k.type === 'table_row');
          if (!rows.length) break;
          const toRow = (r: any) => '| ' + r.table_row.cells.map((c: any) => richText(c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |';
          const md = [toRow(rows[0])];
          md.push('| ' + Array(rows[0].table_row.cells.length).fill('---').join(' | ') + ' |');
          rows.slice(1).forEach((r) => md.push(toRow(r)));
          out.push(md.join('\n')); break;
        }
        case 'table_row': break;   // handled by its parent table
        // Two of the workshop pages hold an older draft of themselves as a
        // nested page. Rendering it would publish the draft under the real one.
        case 'child_page': break;
        default:
          seenUnhandled.add(t);
          out.push(`<!-- unhandled Notion block: ${t} -->`);
      }
    }
    return out.filter((s) => s !== undefined && s !== '').join('\n\n');
  }

  return { blocksToMd, seenUnhandled };
}

/** A heading that says `Teaser` and nothing else.
 *
 *  The one thing the template takes out of a body, and it is a marker rather
 *  than content: it names the section for whoever is writing it, and on the
 *  page it would be a heading a reader has to skip and a chip in the contents
 *  pointing at it. Deleting it in Notion has exactly the same effect, and the
 *  Collaborative Software Design page has already done that.
 *
 *  Nothing else is removed. The paragraphs, pictures, columns and dividers
 *  reach the page in the order and the shape somebody put them in. */
export function withoutTeaserHeading(body: string): string {
  return body
    .split('\n')
    .filter((l) => !/^#{2,6}\s*Teaser\s*$/.test(l.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Dividers, tidied.
 *
 * A divider is a SEAM: the workshop page draws a heavy rule and opens the next
 * section on a plate. Three placements draw nothing, and all three are things
 * an editor does without thinking about it:
 *
 *   - one at the very top, above the first heading;
 *   - one at the very bottom, closing the last section;
 *   - two in a row.
 *
 * They are dropped here rather than reported, because none of them is a
 * mistake worth telling somebody about. A divider that sits mid-body above a
 * paragraph IS worth reporting, and `strayDividers` in the sync does that.
 */
export function tidyDividers(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  const isRule = (l: string) => l.trim() === '---';
  const restIsBlank = (i: number) => lines.slice(i + 1).every((l) => !l.trim());

  for (const [i, line] of lines.entries()) {
    if (!isRule(line)) { out.push(line); continue; }
    // Nothing but blank lines above it, or below it.
    if (out.every((l) => !l.trim())) continue;
    if (restIsBlank(i)) continue;
    // The one before it, ignoring blanks, was also a rule.
    const prev = [...out].reverse().find((l) => l.trim());
    if (prev && isRule(prev)) continue;
    out.push(line);
  }
  // Dropping a rule leaves the blank line that followed it, so a run of three
  // or more newlines is what a removed divider looks like afterwards.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd();
}

/** Where the `Teaser` section starts and ends.
 *
 * Line based rather than one regular expression, because the section runs to
 * the next heading of any depth OR to the end of the document, and expressing
 * "or the end" in a JavaScript regular expression is where `\Z` gets written
 * by mistake. `\Z` is not an escape in JavaScript; it matches a literal Z, and
 * the version this replaced had exactly that in it.
 */
function teaserRange(body: string): { start: number; end: number } | null {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => /^#{2,6}\s*Teaser\s*$/.test(l.trim()));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#{2,6}\s/.test(lines[i])) { end = i; break; }
  }
  return { start, end };
}

/** The first block of real prose. Skips headings, images, tables and raw HTML,
 *  so a teaser that opens with a set of columns does not hand back a `<div>`
 *  as the workshop's pitch. */
function firstProse(blocks: string[]): number {
  return blocks.findIndex((b) => { const t = b.trim(); return t !== '' && !/^[#!|<]/.test(t); });
}

/** The paragraph the page opens with.
 *
 *  Read for the description and for the card on `/training/`, and read only.
 *
 *  It used to be cut out of the body and printed as the hero's lede, and all
 *  four of the bugs that followed were consequences of that cut: it was
 *  lifted and left behind, so the page said it twice; it was taken out of a
 *  column, so the picture beside it stood next to nothing; the paragraph
 *  under the block was moved up to fill the hole, so the page stopped
 *  matching the page in Notion. A body the template edits is a body nobody
 *  can predict from looking at Notion. */
export function teaserOf(body: string): string | undefined {
  const range = teaserRange(body);
  const lines = body.split('\n');
  const scope = range ? lines.slice(range.start + 1, range.end).join('\n') : body;
  const blocks = scope.split(/\n{2,}/).map((b) => b.trim());
  const i = firstProse(blocks);
  return i >= 0 ? blocks[i].replace(/\s+/g, ' ') : undefined;
}
