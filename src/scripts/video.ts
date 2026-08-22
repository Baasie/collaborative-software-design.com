/** Click-to-load for the talk on the home page.
 *
 * The live WordPress page embeds YouTube directly, which is why it also needs a
 * cookie banner. Here the page ships a poster and a button, and the player is
 * built only when somebody presses play — so a visitor who never watches the
 * talk is never announced to Google, and the privacy policy keeps saying
 * something true.
 *
 * The host is `youtube-nocookie.com` and `autoplay=1` is set, because a visitor
 * who clicked play has asked for the video to start; without it they would have
 * to click a second time on the real player.
 *
 * With no JavaScript the button does nothing, which is why the caption under it
 * is a plain link to the talk rather than a title.
 */
export function initVideo(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('.js-video-play')) {
    button.addEventListener('click', () => {
      const id = button.dataset.video;
      if (!id) return;

      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
      frame.title = button.getAttribute('aria-label')?.replace(/^Play: /, '') ?? 'Video';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';

      button.replaceWith(frame);
      // Focus was on the button that no longer exists. Without this the next
      // Tab starts from the top of the document.
      frame.focus();
    }, { once: true });
  }
}
