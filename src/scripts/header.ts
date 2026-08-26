/** The header: collapse on scroll, and the mobile menu toggle.
 *
 * The header is `position: sticky` in CSS and stays that way without
 * JavaScript. This upgrades it to `fixed` (via `html.js-header-fixed`, with
 * `--header-h` holding the space it used to take) because a *sticky* header
 * that shrinks removes its own height from the page, and the browser hands
 * those pixels back as scroll. That flips the collapse straight off again, and
 * the page cannot be scrolled past its own header. No threshold fixes it: the
 * feedback loop is the layout, not the number.
 */
export function initHeader(): void {
  const header = document.getElementById('site-header');
  if (!header) return;

  // Measure both heights once, with the transition suppressed so the flip is
  // not visible, and record them for `scroll-padding-top` in global.css. That
  // matters more here than on most sites: half the main menu is an anchor.
  const measure = () => {
    header.classList.add('js-measuring');
    const wasScrolled = header.classList.contains('scrolled');
    header.classList.remove('scrolled');
    const tall = header.offsetHeight;
    header.classList.add('scrolled');
    const slim = header.offsetHeight;
    header.classList.toggle('scrolled', wasScrolled);
    document.documentElement.style.setProperty('--header-h', `${tall}px`);
    document.documentElement.style.setProperty('--header-slim-h', `${slim}px`);
    document.documentElement.classList.add('js-header-fixed');
    requestAnimationFrame(() => header.classList.remove('js-measuring'));
  };
  measure();
  addEventListener('resize', measure, { passive: true });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('scrolled', scrollY > 80);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const toggle = header.querySelector<HTMLButtonElement>('.nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // A menu that stays open after the visitor has gone somewhere is a menu
  // covering the page they asked for.
  header.querySelectorAll('.site-nav a').forEach((a) =>
    a.addEventListener('click', () => {
      header.classList.remove('nav-open');
      toggle?.setAttribute('aria-expanded', 'false');
    }),
  );
}
