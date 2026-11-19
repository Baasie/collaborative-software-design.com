/** The authors' portraits, and the byline of an article.
 *
 * The portraits used to be imported by the home page alone. An article's byline
 * needs the same three pictures, and a second set of imports would be a second
 * place for a new photograph to be forgotten. So they live here, keyed by the
 * slug in `AUTHORS`.
 */
import { AUTHORS } from './seo';
import evelyn from '../assets/home/evelyn.jpg';
import kenny from '../assets/home/kenny.jpg';
import gien from '../assets/home/gien.jpg';

export const PORTRAITS: Record<string, ImageMetadata> = {
  'evelyn-van-kelle': evelyn,
  'kenny-baas-schwegler': kenny,
  'gien-verschatse': gien,
};

export type Byline = { name: string; url?: string; bio?: string; portrait?: ImageMetadata };

/** Notion's `Authors` names, as the people they are. A name that matches no
 *  author (a guest, or a typo in a new option) still prints, with no picture
 *  and no bio, rather than vanishing from the byline. */
export function bylineOf(names: string[]): Byline[] {
  return names.map((name) => {
    const a = AUTHORS.find((x) => x.name === name);
    return a ? { name: a.name, url: a.url, bio: a.bio, portrait: PORTRAITS[a.slug] } : { name };
  });
}
