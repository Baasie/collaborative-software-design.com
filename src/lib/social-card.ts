/** The social card derivative, kept apart from `seo.ts`.
 *
 * This is the one piece of the SEO layer that needs Astro's image pipeline,
 * and `astro:assets` only exists inside a build. Holding it here leaves
 * `seo.ts` — where every structured-data decision lives — importable by a
 * plain unit test.
 */
import { getImage } from 'astro:assets';
import { abs } from './seo';

/** One 1200px JPEG, used by both the OG tags and the JSON-LD so they agree and
 *  only one derivative is emitted.
 *
 *  Never reference the original asset here: `.src` points at the unoptimised
 *  source file, which would then ship purely to satisfy a meta tag. JPEG
 *  rather than WebP because social scrapers still handle WebP inconsistently. */
export async function socialCard(site: URL | undefined, image: ImageMetadata) {
  // Sharp cannot rasterise SVG here, and scrapers will not render one anyway.
  if (image.format === 'svg') return abs(site, image.src);
  const card = await getImage({ src: image, width: 1200, format: 'jpeg', quality: 80 });
  return abs(site, card.src);
}
