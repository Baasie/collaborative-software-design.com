# What the WordPress site actually is

Crawled 2026-08-21 from the Yoast sitemaps. This is the map the migration has
to satisfy, 42 addresses, and every one of them is a promise.

## It is a book site

This matters more than any single page. The site sells **the book**; the
training and consulting hang off it, and the Dear CoMo column sits behind the
FAQ. The home page opens "A book about Collaborative Software Design" and the
persistent header button is **BUY BOOK**.

## The navigation, as it stands

| Label | Goes to |
|---|---|
| Home | `/` |
| What's inside | `/#whatsinside` (an anchor on the home page) |
| Bookings ▸ | `#`. A dropdown, not a page |
| ⤷ Training | `/training/` |
| ⤷ Consulting | `/facilitation/` |
| FAQ | `/faq/` |
| Contact | `/#contact` (an anchor on the home page) |
| **BUY BOOK** | Manning, with the affiliate parameters below |

The Manning link carries tracking that must be preserved verbatim:

```
https://www.manning.com/books/collaborative-software-design?utm_source=baas&utm_medium=affiliate&utm_campaign=book_baas_collaborative_2_1_23&a_aid=baas&a_bid=2f174b8d
```

Dropping `a_aid`/`a_bid` silently costs the authors their affiliate revenue.

## Two things I had wrong before seeing the site

1. **The Dear CoMo letters are already at `/dear-como/{slug}/`.** I had guessed
   WordPress served them at the root and planned fifteen redirects. It does
   not, and they do not need any. The addresses match what the new site
   already serves.
2. **`/faq/` *is* the Dear CoMo index.** It is not a list of questions about the
   book; it is the archive of the column, every letter, newest first. So the
   index lives at `/faq/` and the letters at `/dear-como/…`, which is an odd
   split but a live one.

## The 42 addresses

| Group | Count | What the new site does |
|---|---|---|
| `/dear-como/{slug}/` | 15 | **Served as-is.** No redirect needed. |
| `/` | 1 | Served. |
| `/training/` | 1 | Served, now driven from Notion, with five workshops instead of one. |
| `/facilitation/` | 1 | Served. The consulting page. |
| `/faq/` | 1 | Served, as the Dear CoMo index. |
| `/the-need-for-collaborative-design/` | 1 | Served. Chapter #01. |
| `/what-is-collaborative-modeling/` | 1 | Served. Chapter #02. |
| `/facilitating-collaborative-modeling/` | 1 | Served. Chapter #05. |
| `/category/dear-como/` | 1 | **301** → `/faq/`. A WordPress category archive duplicating the index. |
| `/tag/{slug}/` | 18 | **301** → `/faq/#tag={slug}`, into the filter. |
| `/author/kenny/` | 1 | **301** → `/#authors`. A WordPress author archive with one author. |

The 18 tags are: active-listening, behavioural-patterns, cognitive-bias,
collaboration-styles, collaborative-modelling, conflict-management,
crucial-conversations, deep-democracy, facilitation, group-dynamics,
handling-resistance, power-dynamics, **preperation**, psychological-safety,
role-switching, software-architecture, team-dynamics, ubiquitous-language.

`preperation` is misspelled in Notion and therefore in the URL. The tag
normaliser fixes the *display* to "Preparation"; the **address keeps the
misspelling**, because it is a live URL and rule 2 does not care that it is
ugly.

## Pages the new build has to gain

The first build was made without sight of this site and guessed at the
structure. These are real pages that exist and were missed:

- The three **chapter** pages (#01, #02, #05), each a teaser plus a BUY BOOK
  call to action, cross-linked to the other two.
- `/facilitation/`: "Software design facilitation", the consulting offer.
- `/faq/` as the Dear CoMo index.
- The home page's real sections: hero, three chapter teasers, "The book" with a
  cover mockup and a testimonial, "What you will learn" (four icons), the
  Bookings call to action, "The authors" (three bios and portraits), and a
  **contact form** at `#contact`.

And one page it should **lose**: `/articles/`. Nothing is published under that
Category in Notion and no such section exists on the live site.

## The contact form is the open question

Every page ends at `/#contact`, a form with Name, Email, Message and a "I want
to book a: training / consulting" selector. A static site cannot process a form
post, so this needs a decision: a hosted form endpoint, a `mailto:`, or a
booking link. It is the one piece of the migration that is not a straight port.
