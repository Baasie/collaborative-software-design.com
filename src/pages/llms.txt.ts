import type { APIContext } from 'astro';
import { letters, trainings, hrefOf } from '../lib/collections';
import { CHAPTERS } from '../lib/nav';
import { SITE_NAME, SITE_TAGLINE, BOOK_URL_PLAIN, AUTHORS, SITE_URL } from '../lib/seo';

/** https://llmstxt.org. A map of the site for an agent reading it.
 *
 * Links point at the `.md` twin of each page rather than the HTML, because
 * that is the point: the words, with no nav and no cards to strip. */
export async function GET(context: APIContext) {
  const abs = (p: string) => new URL(p, context.site ?? SITE_URL).toString();
  const [ls, ts] = [await letters(), await trainings()];

  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_TAGLINE}. The site for the book of the same name, by`,
    `> ${AUTHORS.map((a) => a.name).join(', ')} (Manning).`,
    '',
    `The book: ${BOOK_URL_PLAIN}`,
    'Pages under /dear-como/ and /training/ are also available as markdown at `<url>index.md`.',
    '',
    '## The book',
    '',
    ...CHAPTERS.map((c) => `- [Chapter #${c.number}: ${c.title}](${abs(c.href)})`),
    '',
    '## Training and consulting',
    '',
    ...ts.map((t) => `- [${t.data.title}](${abs(`/training/${t.id}/index.md`)})${t.data.format ? ` (${t.data.format})` : ''}`),
    `- [Software design facilitation](${abs('/facilitation/')})`,
    '',
    '## Dear CoMo',
    '',
    `An advice column for facilitators; the index is at ${abs('/faq/')}.`,
    '',
    ...ls.map((e) => `- [${e.data.title}](${abs(`${hrefOf(e)}index.md`)})`),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
