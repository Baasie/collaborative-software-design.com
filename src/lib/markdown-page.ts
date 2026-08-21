/** The markdown behind a page, served next to it.
 *
 * Every page here is generated from markdown we hold anyway, so
 * `/dear-como/<slug>/index.md` costs a file and no authoring. It is the
 * cheapest thing we can do for an agent reading the site: no HTML to strip, no
 * nav, no cards — the words, and a header saying what they are and where the
 * canonical page is.
 */
import type { APIContext } from 'astro';
import { SITE_URL } from './seo';

export interface MarkdownPage {
  title: string;
  /** Site-relative path of the HTML page this belongs to. */
  path: string;
  body: string;
  date?: Date;
  tags?: string[];
  extra?: Record<string, string | undefined>;
}

const yaml = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const list = (v: string[]) => `[${v.map(yaml).join(', ')}]`;

/** A `text/markdown` response: front matter, then the body. */
export function markdownFor(
  context: APIContext,
  describe: (entry: any) => MarkdownPage,
): Response {
  const { entry } = context.props as { entry: unknown };
  const page = describe(entry);
  const url = new URL(page.path, context.site ?? SITE_URL).toString();
  const lines = [
    '---',
    `title: ${yaml(page.title)}`,
    `source: ${yaml(url)}`,
    ...(page.date ? [`date: ${page.date.toISOString().slice(0, 10)}`] : []),
    ...(page.tags?.length ? [`tags: ${list(page.tags)}`] : []),
    ...Object.entries(page.extra ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${yaml(v as string)}`),
    '---',
    '',
    `# ${page.title}`,
    '',
    page.body.trim(),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
