# The real brand, lifted from the live site

Crawled 2026-08-21 from https://collaborative-software-design.com (WordPress +
Divi + Yoast). Everything here is a **measured fact from the live CSS**, not a
guess — the source of each value is named so it can be re-checked.

## Colours

| Token | Value | Where it comes from |
|---|---|---|
| Accent / brand | `#9D0064` | Divi's configured `"accent_color":"#9d0064"`. Every link (`a{color:#9d0064}`), the top header bar, footer widget headings, the primary button fill, and the "What's inside" section ground. |
| Ground | `#E37B45` | `body.custom-background{background-color:#e47b45}` and `.et_pb_section_0{background-color:#E37B45!important}`. The page ground is **orange**, not white. (`#E37B45` and `#e47b45` both appear — one is the section, one the body; they differ by one hex digit and read as the same colour.) |
| Text | `#000000` | The customizer override `body{color:#000000}` — pure black, not Divi's default `#666`. |
| White | `#FFFFFF` | Section grounds, button text on the magenta. |
| Pink | `#E69EC6` | `.et_pb_section_5` — the "In need of consultancy or training" band on the home page. |
| Light blue | `#AEC9E9` | `.et_pb_section_6` — the "The authors" band on the home page. |
| Grey | `#EBEBEB` | `.et_pb_section_4` — the band behind the GOTO talk. |

The home page is **not orange-and-magenta alone**. It runs a band of tints, one
per section, and the sequence is as much the brand as the two headline colours:
orange hero → magenta "what's inside" → white "the book" → white "what you will
learn" → grey talk → pink bookings → blue authors → orange contact. A version of
that page in one ground colour with cards on it is a different page. Measured
2026-08-22 as rendered, not read off a swatch.

**Not brand, despite appearing often:** `#212121`, `#4e4b66`, `#f4f4f4`,
`#1863dc` are all CookieYes consent-plugin chrome, and `#2ea3f2` is Divi's
factory blue. The Gutenberg default swatches (`#ff6900`, `#fcb900`, `#7bdcb5`,
`#8ed1fc`, `#9b51e0`, `#cf2e2e`…) are noise from the block editor.

### Contrast, computed

| Pair | Ratio | Verdict |
|---|---|---|
| Black on `#E37B45` | 7.15:1 | Passes AA and AAA for body text. |
| White on `#9D0064` | 8.02:1 | Passes comfortably. |
| `#9D0064` on white | 8.02:1 | Links on a white panel are fine. |
| **`#9D0064` on `#E37B45`** | **2.73:1** | **Fails.** Magenta text must never sit on the orange ground — it needs a white or black plate under it. |
| Black on `#E69EC6` | 10.1:1 | The pink band takes ink. |
| Black on `#AEC9E9` | 12.3:1 | The blue band takes ink. |
| Black on `#EBEBEB` | 17.6:1 | The grey band takes ink. |
| **Black on `#9D0064`** | **2.62:1** | **Fails — and the live site does it.** Every heading and paragraph in the "What's inside" band is black on the magenta. This rebuild sets them white (8.02:1) instead. It is the one place the site deliberately departs from what is live. |

That last row is the one to be careful about, and it is exactly what the
browser contrast test in the test suite is for.

## Typography

```css
h1,h2,h3,h4,h5,h6 { font-family: 'PT Sans Narrow', Helvetica, Arial, Lucida, sans-serif; }
body,input,textarea,select { font-family: 'IBM Plex Mono', monospace; }
```

Condensed sans headings over a **monospace body** — an unusual and very
deliberate pairing, and a large part of what makes the site feel like itself.

- **PT Sans Narrow** — only 400 and 700 are loaded.
- **IBM Plex Mono** — the Google Fonts request asks for the full range
  (100–700 plus italics), but the site only visibly uses regular and bold.
- Display heading: `font-weight:700; font-size:60px; letter-spacing:1px;
  line-height:1.1em` (`.et_pb_text_0`); the home page's `h1` is 70px.
- Body: `line-height:2em` — notably airy, which monospace needs.
- **Nothing is set in capitals by CSS.** Every heading on the site measures
  `text-transform:none`, from the 70px hero down to a 20px card title. The
  buttons look like capitals because their *copy* is typed that way ("SEE THIS
  CHAPTER", "BUY BOOK"), not because anything transforms them. The rebuild had
  this wrong for a while and shouted every heading.
- Heading sizes as rendered: `h2` 46–51px weight 600, `letter-spacing:2px`;
  section `h3` 29px; a card title 20–23px.
- **Buttons are set in the MONO**, not the condensed face: `IBM Plex Mono`,
  `14px`, `letter-spacing:1px`, black fill with white text, and on hover the
  magenta with a white border.
- **The eyebrow** — "Chapter #01", "Discover", "Bookings", "About", "Contact" —
  is plain `IBM Plex Mono` at `16px` in black. No capitals, no tracking, and
  never the accent colour, on any ground.
- The menu is the body face at `16px` in sentence case ("What's inside", not
  "WHAT'S INSIDE"). It is magenta on the orange header, which is the 2.73:1
  pairing; the rebuild uses ink and carries the current state on an underline.

## The logo

`reference/brand/logo.png` (500×82) — three condensed uppercase words
**overlapping**: COLLABORATIVE in pink, SOFTWARE in crimson, DESIGN as a black
outline. The overlap is the idea: three things layered into one.

`logo-diap.png` is the same wordmark without the outlined DESIGN, for use on a
coloured ground.

Both are raster PNGs. If a vector original exists, it is worth asking Art of
Design for it — the header renders the wordmark at 500px wide and it will
soften on a high-DPI screen.

## Motion

The live site animates on scroll, through Divi's waypoints, and one of them is
worth keeping: the three **author portraits** come in at `scale(0.5)` and
`opacity: 0` and zoom to full size over **1s, linear**, once, when they enter
the viewport. Measured, not guessed — `.et_pb_image_6` reports
`matrix3d(0.5 … )` at the start of its run and `none` at the end.

Reproduced by `src/scripts/reveal.ts` plus the `.js-reveal` pattern in
`patterns.css`. The starting state is behind `html.js`, because the failure
mode is not "no animation", it is "three permanently invisible portraits";
`browser.test.mjs` checks both halves of that.

Two other animations on the live page are NOT reproduced, and could be:
`.et_pb_image_1` (the chapter photograph) slides in from the left, and the
whole thing is decorative.

## The icon

`reference/brand/favicon-source.jpg` — `cropped-favicon_csd.jpg` off the live
site at its full 512×512. It is the woman from the book cover, cropped to her
head, on white. A photograph, which is why there is no SVG icon on this site;
the placeholder it replaced was a drawing of coloured bars that looked nothing
like anything else here.

The live site serves it at 32, 180 (apple-touch), 192 and 270 (Windows tile), as
JPEG. This one does the same, plus a `favicon.ico` for anything that still asks
for `/favicon.ico` by habit. Regenerate the lot with
`node scripts/make-icons.mjs`.

## Credit

The footer reads: `©2024 Collaborative Software Design | Webdesign by Art of
Design` → https://artofdesign.nl/. **Keep that credit.**

## Which logo goes where

There are two variants, and the live site uses both:

- `logo.png` — DESIGN outlined in **black**. For white and near-white grounds.
  Yoast names this one as the organisation logo.
- `logo-diap.png` — the same wordmark with DESIGN outlined in **white**
  ("diapositief", reversed). For a coloured ground.

The live header uses `logo-diap.png` at **320×52**, and keeps using it when the
sticky header turns white — at which point the white outline of DESIGN sits on
white and the word all but disappears. That is a bug rather than a decision, so
this site ships both and swaps on scroll: `diap` on the orange, `logo.png` once
the header goes white. `src/components/Logo.astro` takes a `variant` prop.

## What the header does

Worth knowing before "correcting" it: the live header is the **orange** ground
with **black** menu links, and turns **white** on scroll —
`.et_pb_section_0_tb_header` is `#E37B45`, and `#FFFFFF` in its fixed state,
with `.et_pb_menu_0_tb_header … a{color:#000000!important}`.

The rebuild does the same, and the current nav item is marked by a magenta rule
**under** the word rather than by colouring it. That is not a style preference:
magenta type on the orange header measures 2.74:1, and the header changes ground
on scroll, so the ink is the only text colour that reads on both.

Measured at 1440px, at rest: 161px tall, the row at `width:90%` (wider than the
1080px the page content uses), the wordmark 320×52 at the left, the menu
starting immediately after it, and BUY BOOK at the far right. Sticky: 125px.

BUY BOOK is **outlined, not filled** — transparent with a `1px solid` black rule
and 20px black type, filling with the magenta only on hover. A magenta fill at
rest is the one thing this header cannot have; it sits on the orange.

## What the footer does

Almost nothing, and that is the design. The live footer is a single **white**
bar, 53px tall, holding one line of 12px mono: "©2024 Collaborative Software
Design | Webdesign by Art of Design". No navigation, no logo, no social links —
the orange contact band directly above it carries the address and the two 50×50
social icons, so the footer has nothing left to repeat.

This rebuild adds exactly one thing to that line: a link to the privacy policy.
The live site reaches that page from its cookie banner, and this site has no
cookie banner, so without the link the page would be reachable only by typing
its address.

The site's own links live one band higher, under **Explore** in the orange
contact section — the shape virtualddd.com uses. That band was half-empty
before: the copy stops at 34rem and everything right of it was air. The list is
generated from `NAV` and `CHAPTERS`, so it cannot point at a page that no longer
exists, and it is the only place the three chapters are listed at all; the menu
never names them.
