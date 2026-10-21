// Run with Node 22.6+: node --experimental-strip-types --test scripts/nba/week.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { lineupWeeks, weekGames } from '../../src/nba/lib/week.ts';

const day = (number, slots, played = [], playedFor = {}) => ({
  day: number,
  rosters: { 1: Object.keys(slots).map(Number) },
  slots,
  players: played.map((id) => [1, id, slots[id], 1]),
  playedFor,
  tx: [],
});

const calculate = (overrides) => weekGames({
  week: { index: 1, first: 1, last: 3 },
  latestDay: 2,
  days: [day(1, { 101: 4 }), day(2, { 101: 4 })],
  names: { 101: 'Starter' },
  proTeams: { 101: 10 },
  schedule: { 10: [1, 2, 3] },
  today: { day: 2, games: [{ home: 10, away: 20, state: 'pre' }] },
  ...overrides,
}).teams.get(1);

test('lineup weeks include the short opening week and a partial final week', () => {
  assert.deepEqual(lineupWeeks('2026-10-20', 15), [
    { index: 1, first: 1, last: 6 },
    { index: 2, first: 7, last: 13 },
    { index: 3, first: 14, last: 15 },
  ]);
});

test('starter totals split into played, lost, and remaining; bench and IR are excluded', () => {
  const slots = { 101: 4, 102: 12, 103: 13 };
  const t = calculate({
    days: [day(1, slots, [101, 102, 103]), day(2, slots)],
    proTeams: { 101: 10, 102: 10, 103: 10 },
    today: { day: 2, games: [{ home: 10, away: 20, state: 'post' }] },
  });
  assert.equal(t.starters.length, 1);
  assert.deepEqual(t.starters[0].cells, ['played', 'lost', 'upcoming']);
  assert.deepEqual([t.scheduled, t.played, t.live, t.lost, t.upcoming], [3, 1, 0, 1, 1]);
});

test('a game on now is not marked lost before the final buzzer', () => {
  const t = calculate({ today: { day: 2, games: [{ home: 10, away: 20, state: 'in' }] } });
  assert.deepEqual(t.starters[0].cells, ['lost', 'live', 'upcoming']);
  assert.equal(t.scheduled, t.played + t.live + t.lost + t.upcoming);
});

test('future games use a traded player’s new NBA team; played games retain the old team', () => {
  const t = calculate({
    days: [day(1, { 101: 4 }, [101], { 101: 10 }), day(2, { 101: 4 })],
    proTeams: { 101: 30 },
    schedule: { 10: [1, 2], 30: [3] },
  });
  assert.deepEqual(t.starters[0].cells, ['played', 'off', 'upcoming']);
  assert.equal(t.scheduled, 2);
});

test('recorded appearances count even when the schedule feed is missing the game', () => {
  const t = calculate({ days: [day(1, { 101: 4 }, [101]), day(2, { 101: 4 })], schedule: { 10: [3] } });
  assert.deepEqual(t.starters[0].cells, ['played', 'off', 'upcoming']);
});

test('past days use their own lineups and future days use the latest lineup', () => {
  const t = calculate({
    days: [day(1, { 101: 12 }), day(2, { 101: 4 })],
    today: { day: 2, games: [{ home: 10, away: 20, state: 'post' }] },
  });
  assert.deepEqual(t.starters[0].cells, ['out', 'lost', 'upcoming']);
  assert.equal(t.scheduled, 2);
});

test('a zero-game stat line is not treated as an appearance', () => {
  const d = day(1, { 101: 4 }, [101]);
  d.players[0][3] = 0;
  const t = calculate({ days: [d, day(2, { 101: 4 })] });
  assert.deepEqual(t.starters[0].cells, ['lost', 'upcoming', 'upcoming']);
});
