/** The zoom-in the live site plays on the author portraits.
 *
 * Divi calls it a waypoint: the module sits at `opacity: 0` and `scale(0.5)`
 * until it scrolls into view, then animates to full size over 1s and stays
 * there. Measured off the live page rather than guessed — `.et_pb_image_6`
 * reports `matrix3d(0.5 … )` at the start of the run and `none` at the end,
 * with `animation-duration: 1s` and `animation-timing-function: linear`.
 *
 * Three things this has to get right, and all three are about what happens
 * when it does NOT run:
 *
 *   - The hidden starting state is applied under `html.js` only. Without that,
 *     a visitor with no JavaScript gets three permanently invisible portraits,
 *     which is a far worse page than one with no animation.
 *   - If `IntersectionObserver` is missing, everything is revealed at once, for
 *     the same reason.
 *   - `prefers-reduced-motion` is handled in global.css, which collapses every
 *     animation on the site to 0.01ms. The class still lands, so the end state
 *     is still reached — it just arrives immediately.
 *
 * It fires once per element and then stops watching it: this is an entrance,
 * not a scroll effect, and re-running it as somebody scrolls back up would be
 * a different and much more annoying thing.
 */
const REVEALED = 'is-revealed';

export function initReveal(): void {
  const targets = [...document.querySelectorAll<HTMLElement>('.js-reveal')];
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    for (const el of targets) el.classList.add(REVEALED);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(REVEALED);
        observer.unobserve(entry.target);
      }
    },
    // A little into the viewport rather than the very edge, so the zoom is
    // already running by the time the portrait is somewhere a reader is
    // looking. Divi's waypoint does the same with its own offset.
    { rootMargin: '0px 0px -12% 0px' },
  );

  for (const el of targets) observer.observe(el);
}
