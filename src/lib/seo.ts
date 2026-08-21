/** Site identity and structured data.
 *
 * Everything here is pure and free of `astro:assets`, so `tests/unit/seo.test.mjs`
 * can import it without a build. The one piece that needs the image pipeline —
 * the social card derivative — lives in `social-card.ts`.
 */

export const SITE_NAME = 'Collaborative Software Design';
export const SITE_URL = 'https://collaborative-software-design.com';
export const SITE_TAGLINE = 'How to facilitate domain modelling decisions';

/** The book's address at Manning, with the affiliate parameters the live site
 *  carries.
 *
 *  These are NOT decoration and must not be tidied away: `a_aid` and `a_bid`
 *  are the authors' affiliate identifiers, and a "cleaner" link silently costs
 *  them the revenue on every sale the site sends. A test pins them. */
export const BOOK_URL =
  'https://www.manning.com/books/collaborative-software-design'
  + '?utm_source=baas&utm_medium=affiliate&utm_campaign=book_baas_collaborative_2_1_23'
  + '&a_aid=baas&a_bid=2f174b8d';

/** The plain address, for a citation rather than a call to action — JSON-LD,
 *  and the one place the live site links without the affiliate tail. */
export const BOOK_URL_PLAIN = 'https://www.manning.com/books/collaborative-software-design';

/** Where the site's mail goes. Held here because it is the site's identity,
 *  not its content, and because every "get in touch" on every page resolves to
 *  it — `mailto:` rather than a form, since a static site cannot process a
 *  post. See docs/migration-inventory.md. */
export const CONTACT_EMAIL = 'info@collaborative-software-design.com';

/** A pre-filled mailto, so the reply lands with a subject somebody can file.
 *  `subject` is encoded; a raw `&` or `?` in it would truncate the URL. */
export function mailto(subject: string, body?: string): string {
  const q = new URLSearchParams({ subject, ...(body ? { body } : {}) });
  return `mailto:${CONTACT_EMAIL}?${q.toString().replace(/\+/g, '%20')}`;
}

export const SOCIALS = [
  { name: 'LinkedIn', url: 'https://www.linkedin.com/company/collaborative-software-design/' },
  { name: 'Bluesky', url: 'https://bsky.app/profile/collaborative-software-design.com' },
] as const;

/** The three authors. Held here rather than in Notion because they are the
 *  site's identity, not its content, and neither is something an editor should
 *  be able to change by accident from a database row. The bios are the live
 *  site's own words. */
export const AUTHORS = [
  {
    name: 'Evelyn van Kelle',
    slug: 'evelyn-van-kelle',
    url: 'https://www.linkedin.com/in/evelynvankelle/',
    bio: 'is a behavioral change consultant that helps organizations and teams in '
      + 'designing and maintaining socio-technical systems to change environments in '
      + 'such a way that desired behavior can flourish.',
  },
  {
    name: 'Kenny Baas-Schwegler',
    slug: 'kenny-baas-schwegler',
    url: 'https://www.linkedin.com/in/kennybaas/',
    bio: 'is an independent software consultant and trainer specialising in software '
      + 'architecture, technical leadership, and sociotechnical systems design, '
      + 'catalysing organisations and teams towards designing and building sustainable '
      + 'and resilient software architectures.',
  },
  {
    name: 'Gien Verschatse',
    slug: 'gien-verschatse',
    url: 'https://www.linkedin.com/in/gienverschatse/',
    bio: 'is an experienced consultant and software engineer that specializes in domain '
      + 'modelling and software architecture and always looking to bridge the gaps '
      + 'between experts, users, and engineers.',
  },
] as const;

/** An absolute URL for a site-relative path. Meta tags and JSON-LD both need
 *  one; a relative `og:image` is silently dropped by most scrapers. */
export function abs(site: URL | undefined, path: string): string {
  return new URL(path, site ?? SITE_URL).toString();
}

/** The organisation node every page's JSON-LD hangs off. */
export function organisation(site: URL | undefined) {
  return {
    '@type': 'Organization',
    '@id': `${abs(site, '/')}#organisation`,
    name: SITE_NAME,
    url: abs(site, '/'),
    email: CONTACT_EMAIL,
    sameAs: SOCIALS.map((s) => s.url),
    founder: AUTHORS.map((a) => ({ '@type': 'Person', name: a.name, sameAs: [a.url] })),
  };
}

export function articleJsonLd(opts: {
  site: URL | undefined; url: string; title: string;
  description?: string; image?: string; published?: Date; tags?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.published ? { datePublished: opts.published.toISOString().slice(0, 10) } : {}),
    ...(opts.tags?.length ? { keywords: opts.tags.join(', ') } : {}),
    mainEntityOfPage: opts.url,
    author: AUTHORS.map((a) => ({ '@type': 'Person', name: a.name, sameAs: [a.url] })),
    publisher: organisation(opts.site),
  };
}

/** A `Course` node for a training.
 *
 * Deliberately not an `Event`: these run on request, on dates that live in a
 * booking conversation rather than in Notion, and an Event with no date is a
 * rich result that never appears. */
export function courseJsonLd(opts: {
  site: URL | undefined; url: string; title: string;
  description?: string; image?: string; format?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    url: opts.url,
    provider: organisation(opts.site),
    ...(opts.format ? {
      hasCourseInstance: {
        '@type': 'CourseInstance', courseMode: 'blended', courseWorkload: opts.format,
      },
    } : {}),
  };
}

/** The book itself, for the home page. */
export function bookJsonLd(site: URL | undefined) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: `${SITE_NAME}: ${SITE_TAGLINE}`,
    url: BOOK_URL_PLAIN,
    author: AUTHORS.map((a) => ({ '@type': 'Person', name: a.name, sameAs: [a.url] })),
    publisher: { '@type': 'Organization', name: 'Manning Publications' },
    inLanguage: 'en',
    about: ['Software architecture', 'Domain-Driven Design', 'Facilitation', 'Decision making'],
    provider: organisation(site),
  };
}

/** The page title as it appears in a tab and a search result. The home page is
 *  the one that must not read "Home — Collaborative Software Design". */
export function pageTitle(title: string, { home = false } = {}): string {
  if (home) return `${SITE_NAME} — ${SITE_TAGLINE}`;
  return title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
}
