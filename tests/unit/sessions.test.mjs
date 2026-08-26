import test from 'node:test';
import assert from 'node:assert/strict';
import { lastDay, upcoming, upcomingFor, dateRange, where } from '../../src/lib/sessions.ts';

const run = (over = {}) => ({
  slug: 'collaborative-software-design', name: 'A run',
  start: '2026-11-17', status: 'Open', ...over,
});

test('a run is shown on its last day and gone the day after', () => {
  // The whole reason this database exists: the WordPress page advertised
  // "Tickets: June 16 to 17" months after June, because a date typed into a
  // page has no idea what it means.
  const r = run({ start: '2026-11-17', end: '2026-11-18' });
  assert.equal(upcoming([r], '2026-11-17').length, 1, 'still running');
  assert.equal(upcoming([r], '2026-11-18').length, 1, 'the last day still counts');
  assert.equal(upcoming([r], '2026-11-19').length, 0, 'and then it is over');
});

test('a one-day run ends on the day it starts', () => {
  const r = run({ start: '2026-11-17', end: undefined });
  assert.equal(lastDay(r), '2026-11-17');
  assert.equal(upcoming([r], '2026-11-17').length, 1);
  assert.equal(upcoming([r], '2026-11-18').length, 0);
});

test('upcoming runs come back soonest first', () => {
  const out = upcoming(
    [run({ start: '2027-03-01', name: 'later' }), run({ start: '2026-11-17', name: 'sooner' })],
    '2026-01-01',
  );
  assert.deepEqual(out.map((s) => s.name), ['sooner', 'later']);
});

test('upcomingFor keeps only the workshop asked for', () => {
  const out = upcomingFor(
    [run({ slug: 'a', name: 'mine' }), run({ slug: 'b', name: 'theirs' })],
    'a', '2026-01-01',
  );
  assert.deepEqual(out.map((s) => s.name), ['mine']);
});

test('dates are compared as calendar days, not as instants', () => {
  // `new Date('2026-11-18')` is midnight UTC, so a naive comparison ends an
  // Amsterdam workshop the previous evening for anyone building west of
  // Greenwich. These are plain YYYY-MM-DD strings for exactly that reason.
  const r = run({ start: '2026-11-18', end: '2026-11-18' });
  assert.equal(upcoming([r], '2026-11-18').length, 1);
});

test('a date range prints the month once when it does not cross one', () => {
  assert.equal(dateRange(run({ start: '2026-11-17', end: '2026-11-18' })), '17 to 18 November 2026');
  assert.equal(dateRange(run({ start: '2026-11-17' })), '17 November 2026');
  assert.equal(dateRange(run({ start: '2026-11-30', end: '2026-12-01' })), '30 November to 1 December 2026');
  assert.equal(dateRange(run({ start: '2026-12-31', end: '2027-01-01' })), '31 December 2026 to 1 January 2027');
});

test('where reads as a place, not as two fields', () => {
  assert.equal(where(run({ city: 'Amsterdam', delivery: 'In person' })), 'Amsterdam, in person');
  assert.equal(where(run({ delivery: 'Online' })), 'Online');
  assert.equal(where(run({ city: 'Amsterdam', delivery: 'Online' })), 'Amsterdam');
  assert.equal(where(run()), undefined);
});
