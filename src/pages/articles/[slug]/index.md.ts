import type { APIContext } from 'astro';
import { markdownFor } from '../../../lib/markdown-page';
import { articles } from '../../../lib/collections';
import { normaliseTags } from '../../../lib/tags';

export async function getStaticPaths() {
  return (await articles()).map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET = (context: APIContext) =>
  markdownFor(context, (entry) => ({
    title: entry.data.title,
    path: `/articles/${entry.id}/`,
    body: entry.body ?? '',
    date: entry.data.publishDate,
    tags: normaliseTags(entry.data.tags),
    extra: {
      section: 'Article',
      ...(entry.data.authors.length ? { authors: entry.data.authors.join(', ') } : {}),
    },
  }));
