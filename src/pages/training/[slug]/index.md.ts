import type { APIContext } from 'astro';
import { markdownFor } from '../../../lib/markdown-page';
import { trainings } from '../../../lib/collections';

export async function getStaticPaths() {
  return (await trainings()).map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET = (context: APIContext) =>
  markdownFor(context, (entry) => ({
    title: entry.data.title,
    path: `/training/${entry.id}/`,
    body: entry.body ?? '',
    extra: { section: 'Training', format: entry.data.format },
  }));
