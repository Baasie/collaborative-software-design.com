import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { letters, hrefOf } from '../lib/collections';
import { excerpt } from '../lib/excerpt';
import { normaliseTags } from '../lib/tags';
import { SITE_NAME, SITE_URL } from '../lib/seo';

export async function GET(context: APIContext) {
  const items = await letters();
  return rss({
    title: `${SITE_NAME} — Dear CoMo`,
    description:
      'An advice column for facilitators. Somebody writes in about a room that is '
      + 'not working; CoMo writes back.',
    site: context.site ?? SITE_URL,
    items: items.map((entry) => ({
      title: entry.data.title,
      link: hrefOf(entry),
      description: entry.data.metaDescription ?? excerpt(entry.body ?? '', entry.data.title),
      // Undated entries are legitimate — a letter can be published before
      // anybody sets the date — and `pubDate: undefined` is left out rather
      // than becoming 1970.
      pubDate: entry.data.publishDate ? new Date(entry.data.publishDate) : undefined,
      categories: normaliseTags(entry.data.tags),
    })),
    customData: '<language>en-gb</language>',
  });
}
