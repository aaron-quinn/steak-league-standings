import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { compactProjections } from '../../worker/nba/espn.js';

const { outputFiles } = await build({
  entryPoints: ['src/nba/lib/rosters.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm',
});
const { buildRosters, isOut } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
const line = [100, 40, 20, 10, 5, 5, 35, 70, 20, 25];
const input = {
  league: { latestDay: 5, finalDay: 10, draft: [], teams: [{ id: 1, totals: line }] },
  days: [{ day: 5, rosters: { 1: [101] }, slots: { 101: 0 }, players: [[1, 101, 0, 1, ...line]], tx: [] }],
  names: { 101: 'Example Player' }, proTeams: { 101: 1 },
  schedule: { 1: [1, 3, 5, 7, 9] },
  pool: { players: [['Example Player', 3, 90, ...line]] }, priors: [],
  rates: { perPoint: Array(6).fill(10), shooting: Array(2).fill({ rate: 0.5, attempts: 100, perPoint: 0.01 }) },
};
const player = (games) => buildRosters({ ...input, espn: { 101: [games, 'OUT'] } }).players[0];

test('ESPN games subtract played games, clamp to the schedule, and honor zero', () => {
  assert.equal(player(4).availability, 0.5);
  assert.equal(player(82).availability, 1);
  for (const games of [0, 2, 3]) assert.equal(player(games).projectedValue, 0);
  const fallback = buildRosters(input).players[0];
  for (const games of [null, undefined, NaN, -1]) {
    assert.equal(player(games).projectedValue, fallback.projectedValue);
  }
  assert.equal(player(4).seasonValue, fallback.seasonValue);
  assert.equal(player(4).status, 'OUT');
  assert.ok(isOut({ out: 0, status: 'OUT' }));
  assert.ok(!isOut({ out: 0, status: 'DAY_TO_DAY' }));
});

test('compact projections include IR games and status without adding IR to team totals', () => {
  const entry = (id, slot, games, status = 'OUT') => ({
    lineupSlotId: slot,
    playerPoolEntry: { player: { id, injuryStatus: status,
      stats: [{ id: '102027', statSourceId: 1, stats: { 42: games, 0: 100 } }],
    } },
  });
  const result = compactProjections({ teams: [{ id: 1, roster: {
    entries: [entry(101, 0, 0), entry(102, 13, 39), entry(103, 12, undefined)],
  } }] }, 2027);
  assert.deepEqual(result.players, { 101: [0, 'OUT'], 102: [39, 'OUT'], 103: [null, 'OUT'] });
  assert.equal(result.teams[0].players, 2);
  assert.equal(result.teams[0].totals[0], 200);
});

test('RotoWire games override ESPN without changing per-game talent or injury status', () => {
  const espn = { 101: [4, 'OUT'] };
  const fallback = buildRosters({ ...input, espn }).players[0];
  const p = buildRosters({ ...input, espn, rotowire: { 101: 5 } }).players[0];
  assert.equal(p.availability, 1);
  assert.equal(p.availabilitySource, 'RotoWire');
  assert.deepEqual(p.perGame, fallback.perGame);
  assert.equal(p.status, 'OUT');
  assert.equal(fallback.availabilitySource, 'ESPN');
  assert.equal(buildRosters(input).players[0].availabilitySource, 'History');
  assert.equal(buildRosters({ ...input, espn, rotowire: { 101: 0 } }).players[0].projectedValue, 0);
});
