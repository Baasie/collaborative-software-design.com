// @ts-check
import { defineConfig } from 'astro/config';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { rehypeEmptyAlt } from './src/lib/rehype-alt.mjs';

// https://astro.build/config
export default defineConfig({
  // Canonical origin, used by the sitemap, the feed and every canonical URL.
  site: 'https://collaborative-software-design.com',
  // Every URL ends in a slash, which is what WordPress served. A link that
  // worked yesterday must not 301 today just to gain a slash.
  trailingSlash: 'always',
  markdown: {
    // Astro 7 made Sätteri the default Markdown processor and deprecated
    // `markdown.rehypePlugins`, which belongs to the remark/rehype one. Naming
    // that processor is not a change of behaviour: passing rehypePlugins at
    // all already selected it, so this says out loud what the build was
    // silently doing. Verified by diffing all 31 rendered pages before and
    // after: identical.
    //
    // `gfm` and `smartypants` default to true here, which is what Astro
    // applied before, so neither is set.
    //
    // The plugin gives an image with no caption in Notion an alt attribute.
    // Without one Astro emits no `alt` at all and a screen reader reads the
    // hashed file name. See src/lib/rehype-alt.mjs.
    processor: unified({ rehypePlugins: [rehypeEmptyAlt] }),
  },
  integrations: [
    sitemap({
      // /search/ is a tool for people already here, and an empty results page
      // is the last thing worth offering somebody as an answer; it is
      // `noindex` for the same reason, and a test checks the two agree. /410/
      // is the body of an error response, not a destination.
      filter: (page) => !/\/410\/$/.test(page) && !/\/search\/$/.test(page),
      serialize(item) {
        if (/\/training\/[^/]+\/$/.test(item.url)) {
          item.changefreq = ChangeFreqEnum.MONTHLY; item.priority = 0.9;
        } else if (/\/dear-como\/[^/]+\/$/.test(item.url)) {
          item.changefreq = ChangeFreqEnum.MONTHLY; item.priority = 0.7;
        } else if (/collaborative-software-design\.com\/$/.test(item.url)) {
          item.changefreq = ChangeFreqEnum.WEEKLY; item.priority = 1.0;
        }
        return item;
      },
    }),
  ],
});
