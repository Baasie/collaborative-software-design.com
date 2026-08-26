import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pageTitle, abs, mailto, articleJsonLd, courseJsonLd, bookJsonLd,
  BOOK_URL, SITE_NAME, AUTHORS,
} from '../../src/lib/seo.ts';

const site = new URL('https://collaborative-software-design.com');

test('the home page title does not repeat the site name', () => {
  assert.equal(pageTitle('', { home: true }).split(SITE_NAME).length - 1, 1);
});

test('a page title is suffixed once, and only once', () => {
  // A hyphen, because that is the separator the live site uses:
  // "Consulting - Collaborative Software Design".
  assert.equal(pageTitle('Training'), `Training - ${SITE_NAME}`);
  const already = `${SITE_NAME} in practice`;
  assert.equal(pageTitle(already), already);
});

test('the book URL keeps the affiliate parameters', () => {
  // These are the authors' revenue. A tidier link costs them money and nothing
  // else in the build would notice.
  assert.match(BOOK_URL, /a_aid=baas/);
  assert.match(BOOK_URL, /a_bid=2f174b8d/);
  assert.match(BOOK_URL, /utm_source=baas/);
});

test('a mailto encodes its subject and body', () => {
  const m = mailto('Booking enquiry: training', 'Hi,\n\nthanks');
  assert.ok(m.startsWith('mailto:'));
  // A raw space or newline in the query truncates it in some clients.
  assert.ok(!/[?&](subject|body)=[^&]*[\s]/.test(m), m);
  assert.match(m, /subject=Booking%20enquiry/);
});

test('abs makes an absolute URL from a site-relative path', () => {
  assert.equal(abs(site, '/og-default.png'), 'https://collaborative-software-design.com/og-default.png');
});

test('an article node carries the headline the page actually shows', () => {
  const node = articleJsonLd({
    site, url: 'https://x/', title: 'Why does my colleague never contradict me?',
    description: 'A description.', published: new Date('2025-04-22'), tags: ['Team Dynamics'],
  });
  assert.equal(node['@type'], 'Article');
  assert.equal(node.headline, 'Why does my colleague never contradict me?');
  assert.equal(node.datePublished, '2025-04-22');
  assert.equal(node.author.length, AUTHORS.length);
});

test('an article with no date simply has no datePublished', () => {
  // Absent, not null and not 1970: an undated letter is a real editorial state.
  const node = articleJsonLd({ site, url: 'https://x/', title: 'T' });
  assert.ok(!('datePublished' in node));
  assert.ok(!('image' in node));
});

test('a training is a Course, not an Event', () => {
  // These run on request, on dates that live in a booking conversation. An
  // Event with no date is a rich result that never appears.
  const node = courseJsonLd({ site, url: 'https://x/', title: 'T', format: '2-day' });
  assert.equal(node['@type'], 'Course');
  assert.equal(node.hasCourseInstance.courseWorkload, '2-day');
});

test('the book node names Manning as the publisher', () => {
  const node = bookJsonLd(site);
  assert.equal(node['@type'], 'Book');
  assert.equal(node.publisher.name, 'Manning Publications');
});
