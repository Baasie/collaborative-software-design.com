import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Content is GENERATED from Notion by scripts/sync-notion.ts and written to
// src/content/<collection>/<slug>.md, never hand-edited. These schemas mirror
// the verified Notion data-source schemas; see docs/content-model.md.
//
// Two shapes, because Notion holds them two ways:
//
//   writing     one row each in the `Dear CoMo Content` database. ONE
//               collection, not one per section: it is one database, and
//               splitting it in the schema buys nothing except an empty
//               collection warning for as long as a section has no rows.
//               `section` carries the split, and because it is a field rather
//               than a directory, a row that changes Category is a file that
//               changes one line. Which the sync can see, and turn into a
//               redirect rather than a broken link.
//   trainings   a child page each of the `Workshops` page. No database, so no
//               properties: everything is read out of the body or derived from
//               the page's position.

const seo = {
  // Optional editorial overrides; the layout falls back to title / first
  // paragraph / featured image when these are empty.
  seoTitle: z.string().optional(),
  seoMetadescription: z.string().optional(),
};

// A Notion select is a picker, and adding an option to it is one click nobody
// thinks of as a code change. Holding `status` as a plain string rather than a
// z.enum keeps that click from failing `astro check`, which is the deploy's
// first step, and taking the whole site down over a label. The sync is the
// gate that decides what is published; the build is not.
//
// `section` is the exception, and deliberately so: it is not a label, it is an
// ADDRESS. A value outside this set has no page to be rendered at, so the
// build is the right place to refuse it. Today there is exactly one, because
// the live site has exactly one: the Dear CoMo column. Notion's `Category` also
// offers `Article`, but nothing is published under it and no such section
// exists. The sync reports a published Article as needing a decision rather
// than inventing an address for it. Adding `/articles/` later is this enum,
// one line in the sync's mapping, and a page.
const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: ({ image }) =>
    z.object({
      /** The reader's question. It is the title of the page, and it is a
       *  question rather than a headline because that is the form the column
       *  takes: someone writes in, CoMo writes back. */
      title: z.string(),
      section: z.enum(['dear-como']),
      status: z.string(), // Not started | In progress | Ready for Review | Done | Published
      publishDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      featuredImage: image().optional(),
      /** Notion's `Canonicle URL (optional)`. Set when a piece was published
       *  somewhere else first and that copy should keep the ranking. */
      canonical: z.string().url().optional(),
      focusKeyphrase: z.string().optional(),
      metaDescription: z.string().optional(),
      ...seo,
    }),
});

// Trainings: the workshops the site exists to sell. Generated from the child
// pages of the `Workshops` page in Notion, which is where they are written and
// kept. The training page used to be hand-maintained in WordPress with a
// single workshop on it, and moving it here is the point of this collection.
//
// `format` and `order` are the only two things a page needs that the body
// cannot say for itself: which heading it sat under in Notion ("2-day", "1 day
// or less"), and where in the list it belongs. Both are read off the Workshops
// page's own structure, so re-ordering the site is done by dragging in Notion.
const trainings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/trainings' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** The group heading this training sits under. Optional so a workshop
       *  dragged out from under every heading still renders, ungrouped, rather
       *  than failing the build. */
      format: z.string().optional(),
      /** Position on the Workshops page, so the site lists them in Notion's
       *  order. */
      order: z.number().default(0),
      /** The opening pitch, lifted from the body's `Teaser` section by the sync
       *  so the card, the meta description and the page all say the same thing. */
      teaser: z.string().optional(),
      featuredImage: image().optional(),
      ...seo,
    }),
});

export const collections = { writing, trainings };
