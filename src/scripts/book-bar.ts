/** Shows the booking bar for the middle of a long workshop page.
 *
 * The bar is visible only in the stretch where nothing else is offering to
 * take a booking: after the hero's block has scrolled away, and before the
 * contact band arrives at the foot. Outside that stretch it would either
 * duplicate a control that is already on screen or cover the footer.
 *
 * Two observers rather than a scroll handler. A scroll handler runs on every
 * frame of every scroll for the whole page; these fire twice each, when a
 * boundary is crossed.
 *
 * It ships `hidden`, so a visitor with no JavaScript never sees it. That is
 * the right default: the page carries a call to action at the top and another
 * at the bottom without it, and a bar that cannot be dismissed is worse than
 * no bar when it is the only thing that can go wrong.
 */
export function initBookBar(): void {
  const bar = document.querySelector<HTMLElement>('.js-book-bar');
  if (!bar || !('IntersectionObserver' in window)) return;

  const hero = document.querySelector('[data-test="workshop-hero"]');
  const contact = document.querySelector('#contact');
  if (!hero || !contact) return;

  let heroGone = false;
  let contactHere = false;
  const apply = () => { bar.hidden = !(heroGone && !contactHere); };

  // The hero counts as gone once none of it is on screen.
  new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting; apply(); })
    .observe(hero);

  // The contact band counts as arrived a little before it truly does, so the
  // bar is already out of the way rather than disappearing under the reader's
  // thumb as they reach it.
  new IntersectionObserver(([e]) => { contactHere = e.isIntersecting; apply(); },
    { rootMargin: '0px 0px 120px 0px' })
    .observe(contact);
}
