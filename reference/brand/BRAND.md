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
  line-height:1.1em` (`.et_pb_text_0`).
- Body: `line-height:2em` — notably airy, which monospace needs.

## The logo

`reference/brand/logo.png` (500×82) — three condensed uppercase words
**overlapping**: COLLABORATIVE in pink, SOFTWARE in crimson, DESIGN as a black
outline. The overlap is the idea: three things layered into one.

`logo-diap.png` is the same wordmark without the outlined DESIGN, for use on a
coloured ground.

Both are raster PNGs. If a vector original exists, it is worth asking Art of
Design for it — the header renders the wordmark at 500px wide and it will
soften on a high-DPI screen.

## Credit

The footer reads: `©2024 Collaborative Software Design | Webdesign by Art of
Design` → https://artofdesign.nl/. **Keep that credit.**
