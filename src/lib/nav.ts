/** The navigation, in one place.
 *
 * Follows the live site's menu, including the two anchors: "What's inside" and
 * "Contact" are sections of the home page, not pages. That is why `global.css`
 * sets `scroll-padding-top`, with a sticky header, an anchor that is not
 * offset arrives underneath it.
 *
 * ONE DEPARTURE: the live menu hides Training and Consulting inside a
 * "Bookings" dropdown whose parent goes to `#`. They are top-level items here.
 *
 * Three reasons, and the first is the one that decided it. A parent that goes
 * nowhere cannot be a link, so it had to be rendered as a plain label with the
 * submenu revealed on hover or focus. A workaround for a menu item that is
 * not a destination. The group existed only to hold two things. Second, those
 * two ARE the commercial pages, and a word that names neither of them is a bad
 * place to put a hover before the thing a paying visitor came for. Third, a
 * hover submenu is awkward on a touch screen wide enough to get the desktop
 * menu.
 *
 * They stay adjacent, so they still read as a pair. If a third booking type
 * ever appears, grouping them again is the right move and this is where it
 * goes back.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Listed under "Explore" in the footer. */
  section?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/#whatsinside', label: "What's inside" },
  { href: '/training/', label: 'Training' },
  { href: '/facilitation/', label: 'Consulting' },
  { href: '/faq/', label: 'FAQ', section: true },
  { href: '/#contact', label: 'Contact' },
];

/** The chapter pages, which cross-link to each other on every one of them.
 *  The numbers are the book's, not a sequence: there is no #03 or #04 here.
 *
 *  `title` is how a chapter is named in a list. The footer, the cross-links at
 *  the foot of a chapter. `heading` and `blurb` are what the home page prints,
 *  word for word off the live page, and they are not the same strings: the home
 *  page says "The need for collaborative software design" where the menu says
 *  "The need for collaborative design". Both are kept because both are real. */
export const CHAPTERS = [
  {
    number: '01',
    href: '/the-need-for-collaborative-design/',
    title: 'The need for collaborative design',
    heading: 'The need for collaborative software design',
    blurb:
      'Great technical teams working closely with well-meaning business stakeholders '
      + 'can still deliver software that fails to meet an organization’s needs. We see '
      + 'it every day. Software teams become too focused on finding solutions without '
      + 'fully appreciating the context of the organization. Business stakeholders can '
      + 'be reluctant to voice their concerns in technical sessions. Tensions escalate, '
      + 'and conflicts go unresolved.',
  },
  {
    number: '02',
    href: '/what-is-collaborative-modeling/',
    title: 'What is collaborative modeling?',
    heading: 'What is collaborative modeling',
    blurb:
      'A visualization technique to analyze complex and conflict-laden decision-making '
      + 'processes with all relevant stakeholders and decision-makers to create a shared '
      + 'understanding.',
  },
  {
    number: '05',
    href: '/facilitating-collaborative-modeling/',
    title: 'Facilitating collaborative modeling',
    heading: 'Facilitating collaborative modeling',
    blurb:
      'Collaborative modeling tools alone do not guarantee effective collaboration; '
      + 'someone needs to guide people during collaboration: a facilitator.',
  },
] as const;
