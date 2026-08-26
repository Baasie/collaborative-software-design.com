/** The tag filter on the Dear CoMo index.
 *
 * Pure DOM, no framework, and nothing rendered here: the cards are all in the
 * page already and this only sets `hidden` on the ones that do not match. That
 * is what keeps the no-JavaScript case correct. The page ships complete, and
 * this narrows it.
 *
 * The chosen tag lives in the hash, which is not a nicety: `/tag/{slug}/` is
 * an address the WordPress site answers, and `.htaccess` redirects each one to
 * `/faq/#tag={slug}`. So this reading the hash on load is what makes those
 * eighteen redirects land somewhere meaningful instead of at the top of an
 * unfiltered list.
 */
export function initCardFilter(): void {
  const bar = document.querySelector<HTMLElement>('.js-filter');
  if (!bar) return;
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>('.js-filter-btn')];
  const cards = [...document.querySelectorAll<HTMLElement>('.js-filter-item')];
  if (!cards.length) return;

  const tagOf = () => new URLSearchParams(location.hash.slice(1)).get('tag') ?? '';

  const apply = (tag: string) => {
    for (const card of cards) {
      const tags = (card.dataset.tags ?? '').split(' ').filter(Boolean);
      card.hidden = tag !== '' && !tags.includes(tag);
    }
    for (const b of buttons) {
      const on = (b.dataset.tag ?? '') === tag;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    // A filter that hides everything is a dead end, so say so rather than
    // leaving the visitor looking at an empty page. This is reachable from a
    // legacy /tag/ redirect for a tag no live letter carries any more.
    const empty = document.querySelector<HTMLElement>('.js-filter-empty');
    if (empty) empty.hidden = cards.some((c) => !c.hidden);
  };

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const tag = b.dataset.tag ?? '';
      // `replaceState` for the "everything" case: assigning an empty hash
      // leaves a bare `#` in the address bar and jumps the page to the top.
      if (tag) location.hash = `tag=${tag}`;
      else history.replaceState(null, '', location.pathname + location.search);
      apply(tag);
    });
  }
  addEventListener('hashchange', () => apply(tagOf()));
  apply(tagOf());
}
