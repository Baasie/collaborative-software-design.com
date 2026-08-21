# Brand and code

Rule 3: **the brand is the fixed point.** Layout, copy, components and structure
are open to improvement. The colours, the type and the logo are not.

Every value is measured off the live site and recorded, with its source, in
[reference/brand/BRAND.md](../reference/brand/BRAND.md). If you doubt a colour,
that file names the CSS rule it came from.

## The one thing to know before writing CSS

The page ground is **orange** (`#E37B45`). The brand accent is **magenta**
(`#9D0064`). Together they measure **2.73:1** — nowhere near the 4.5:1 small
text needs.

So **brand-coloured text must never sit directly on the page ground.** It needs
a white plate under it.

This is not theoretical. During this build the browser test caught it three
times: on the eyebrows, on links in prose, and on the current item in the
navigation. Expect to hit it again.

Two consequences are baked into the CSS, and both are load-bearing:

- **`.eyebrow` is ink by default** and becomes magenta only inside
  `.section--paper`, `.card` or `.panel` — i.e. where a plate exists. The safe
  colour is the default; the brand colour is opted into by *context*, not by a
  modifier somebody has to remember to add.
- **Detail pages put their content on a paper plate.** That is also what
  WordPress does (`#main-content{background-color:#fff}`), so it is faithful as
  well as legible.

What reads, and what does not:

| Pair | Ratio | |
|---|---|---|
| Black on the orange ground | 7.15:1 | ✅ |
| White on the magenta | 8.02:1 | ✅ |
| Magenta on white | 8.02:1 | ✅ |
| **Magenta on the orange ground** | **2.73:1** | ❌ |

## The type is a monospace body

```css
h1…h6 { font-family: 'PT Sans Narrow', …; }
body  { font-family: 'IBM Plex Mono', monospace; }
```

Condensed sans headings over a **monospace body**. Unusual, deliberate, and a
large part of why the site reads the way it does. It has two consequences worth
knowing before you "fix" either:

- **`--leading-body` is 1.85**, matching the live site's `line-height:2em`. A
  monospace body needs the air; at 1.5 it reads as a code block.
- **`--content-width` is 40rem, not 44.** Monospace runs about 25% wider per
  character, so the same rem measure is fewer words per line.

Headings are uppercase with a little tracking, as the live display heading is
(`font-weight:700; letter-spacing:1px; line-height:1.1em`) — but **headings
inside `.prose` are not**. A letter's own headings are sentences, and shouting
them changes the author's tone.

## Why a brand change is cheap

Everything visual is written down in exactly one place, and a test keeps it that
way:

```
src/styles/tokens.css       every colour, every face, every measure
src/components/Logo.astro   the wordmark
```

`tests/conformance.test.mjs` fails on a colour literal — a hex, an `rgb()`, an
`hsl()` — anywhere in `src/components/`, `src/layouts/`, `src/pages/`,
`global.css` or `patterns.css`, and on any `font-family` that is not a token.
There is one named exemption, `<meta name="theme-color">`, which the browser
chrome reads before any CSS exists.

This is not hypothetical tidiness: this site's palette has **already been
replaced once**, from a placeholder to the real brand, and it was one file.

## Writing CSS here

- **A colour goes in `tokens.css` or nowhere.** If you need one that is not a
  token, that is a design decision — rule 4 applies: propose it, do not add it.
- **Two tokens for two jobs.** `--on-brand` is text on the magenta;
  `--on-ground` is text on the orange. There is deliberately **no token** for
  brand-on-ground, because that pairing must not exist.
- **Only reusable surfaces are tokens.** The stops inside one component's own
  gradient are a shape, not a token.
- **Three breakpoints, and only three** — 640, 800, 900. Recorded in
  `tokens.css` and written literally in the stylesheets, because CSS cannot use
  a custom property inside a media query. `max-width` companions are 639.98px
  and 799.98px so a range never overlaps its partner.
- **Square corners.** `--radius` is `0px`; the live site is square throughout.
- **Components go in `patterns.css`** if more than one page uses them, and in
  the component's own `<style>` if only one does.

## Adding a component

Check whether `LetterCard`, `TrainingCard`, `PrevNext`, `TagFilter` or
`ContactSection` already does it. A fourth way to render a card is the additive
bias AGENTS.md warns about, and no mechanical check can see it — the new
component is imported by something, so everything calls it used. It is visible
in a diff, by a reader, and nowhere else.

The same goes for the three chapter pages: they share `ChapterLayout` because
they differ only in their words, and a second copy would drift the first time
the chapter switcher gained a fourth entry.

## Accessibility is part of the brand, not a lint pass

Decisions this site has made, and will keep:

- **The navigation works without JavaScript** — including the Bookings
  dropdown, which is revealed by `:focus-within` rather than a click handler. A
  browser test enforces it, and it matters more here than usual: the parent item
  goes to `#`, so without a working submenu two real pages are unreachable.
- **Anchors land below the sticky header.** Half the main menu is an anchor
  (`#whatsinside`, `#contact`), so `scroll-padding-top` is load-bearing, and a
  browser test measures it.
- **The tag filter hides itself without JavaScript** rather than hiding the
  cards. "All the letters" is a perfectly good index; a filter that cannot
  filter is not.
- **The nav's current item is marked by a rule, not a colour** — see the trap
  above.
- **Tap targets are at least 24px**, and links in lists get `min-height`
  explicitly, because the inline exception to WCAG 2.5.8 does not apply to them.
- **A link inside a sentence is underlined.** Colour alone is not enough, and
  here it is worse than usual.
- **`:focus-visible` is never removed**, and is ink so it reads on all three
  grounds.
- **Empty headings never ship.** They arrive from Notion, where pressing `##`
  and changing your mind leaves one behind. The converter drops them, a unit
  test pins that, and a build test is the net.
