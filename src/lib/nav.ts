/** The navigation, in one place.
 *
 * Mirrors the live site's menu exactly, including the two anchors: "What's
 * inside" and "Contact" are sections of the home page, not pages. That is why
 * `global.css` sets `scroll-padding-top` — with a sticky header, an anchor
 * that is not offset arrives underneath it.
 *
 * `Bookings` is a dropdown with no page of its own (`href: '#'` on the live
 * site). Rendered as a group rather than a link: a menu item that goes nowhere
 * is a trap for a keyboard or screen-reader visitor.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Children of a dropdown. The parent is then a label, not a link. */
  children?: { href: string; label: string }[];
  /** Listed under "Explore" in the footer. */
  section?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/#whatsinside', label: "What's inside" },
  {
    href: '#', label: 'Bookings',
    children: [
      { href: '/training/', label: 'Training' },
      { href: '/facilitation/', label: 'Consulting' },
    ],
  },
  { href: '/faq/', label: 'FAQ', section: true },
  { href: '/#contact', label: 'Contact' },
];

/** The chapter pages, which cross-link to each other on every one of them.
 *  The numbers are the book's, not a sequence: there is no #03 or #04 here. */
export const CHAPTERS = [
  {
    number: '01',
    href: '/the-need-for-collaborative-design/',
    title: 'The need for collaborative design',
  },
  {
    number: '02',
    href: '/what-is-collaborative-modeling/',
    title: 'What is collaborative modeling?',
  },
  {
    number: '05',
    href: '/facilitating-collaborative-modeling/',
    title: 'Facilitating collaborative modeling',
  },
] as const;

/** Everything the footer lists under "Explore" — the pages, flattened out of
 *  the dropdown, plus the chapters. One source, so the footer cannot drift
 *  from the header. */
export function footerLinks() {
  const fromNav = NAV.flatMap((n) =>
    n.children ? n.children : n.href.startsWith('/') && n.href !== '/' && !n.href.includes('#') ? [n] : [],
  );
  return [...fromNav, ...CHAPTERS.map((c) => ({ href: c.href, label: c.title }))];
}
