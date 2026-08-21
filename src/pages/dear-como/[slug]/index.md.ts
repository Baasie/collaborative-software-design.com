import type { APIContext } from 'astro';
import { markdownFor } from '../../../lib/markdown-page';
import { letters } from '../../../lib/collections';
import { normaliseTags } from '../../../lib/tags';

export async function getStaticPaths() {
  return (await letters()).map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET = (context: APIContext) =>
  markdownFor(context, (entry) => ({
    title: entry.data.title,
    path: `/dear-como/${entry.id}/`,
    body: entry.body ?? '',
    date: entry.data.publishDate,
    tags: normaliseTags(entry.data.tags),
    extra: { section: 'Dear CoMo' },
  }));
