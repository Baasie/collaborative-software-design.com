import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { writing, hrefOf } from '../lib/collections';
import { excerpt } from '../lib/excerpt';
import { normaliseTags } from '../lib/tags';
import { SITE_NAME, SITE_URL } from '../lib/seo';

/** One feed for everything written here, letters and articles together:
 *  somebody who subscribes wants both, and a second feed is a second thing to
 *  find. Each item says which it is, as its first category, so a reader that
 *  groups by category can still tell them apart. */
export async function GET(context: APIContext) {
  const items = await writing();
  return rss({
    title: `${SITE_NAME}: writing`,
    description:
      'Dear CoMo, an advice column for facilitators, and longer articles by the '
      + 'authors of Collaborative Software Design.',
    site: context.site ?? SITE_URL,
    items: items.map((entry) => ({
      title: entry.data.title,
      link: hrefOf(entry),
      description: entry.data.metaDescription ?? excerpt(entry.body ?? '', entry.data.title),
      // Undated entries are legitimate (a letter can be published before
      // anybody sets the date), and `pubDate: undefined` is left out rather
      // than becoming 1970.
      pubDate: entry.data.publishDate ? new Date(entry.data.publishDate) : undefined,
      categories: [entry.data.section === 'articles' ? 'Article' : 'Dear CoMo', ...normaliseTags(entry.data.tags)],
      ...(entry.data.authors.length ? { author: entry.data.authors.join(', ') } : {}),
    })),
    customData: '<language>en-gb</language>',
  });
}
