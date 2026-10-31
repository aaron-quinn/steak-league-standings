import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { compactProjections } from '../../worker/nba/espn.js';

const { outputFiles } = await build({
  entryPoints: ['src/nba/lib/rosters.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm',
});
const { buildRosters, isOut, slotComparisons } = await import(
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
  const entry = (id, slot, games, status = 'OUT', position = 1) => ({
    lineupSlotId: slot,
    playerPoolEntry: { player: { id, injuryStatus: status, defaultPositionId: position,
      stats: [{ id: '102027', statSourceId: 1, stats: { 42: games, 0: 100 } }],
    } },
  });
  const result = compactProjections({ teams: [{ id: 1, roster: {
    entries: [entry(101, 0, 0, 'OUT', 1), entry(102, 13, 39, 'OUT', 2), entry(103, 12, undefined, 'OUT', 5)],
  } }] }, 2027);
  assert.deepEqual(result.players, { 101: [0, 'OUT'], 102: [39, 'OUT'], 103: [null, 'OUT'] });
  assert.deepEqual(result.positions, { 101: 1, 102: 2, 103: 5 });
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

test('ESPN position ids reach roster players', () => {
  assert.equal(buildRosters({ ...input, positions: { 101: 2 } }).players[0].position, 'SG');
  assert.equal(buildRosters(input).players[0].position, undefined);
});

test('slot comparisons rank each place against the other rosters, overall and by position', () => {
  const p = (id, team, slot, value, position) => ({
    id, team, slot, name: `P${id}`, projectedValue: value, seasonValue: value / 2, position,
  });
  const teams = [
    { id: 1, players: [p(11, 1, 0, 100, 'PG'), p(12, 1, 12, 50, 'SG'), p(13, 1, 12, 80, 'C'), p(14, 1, 13, 200, 'C')] },
    { id: 2, players: [p(21, 2, 0, 90, 'PG'), p(22, 2, 12, 60, 'SG'), p(23, 2, 12, 40, 'C')] },
    { id: 3, players: [p(31, 3, 0, 80, 'SG'), p(32, 3, 12, 70, 'C'), p(33, 3, 12, 30, 'PG')] },
  ];
  const comparisons = slotComparisons(teams, 'projected');
  // Best on team 1 against the best on the other two rosters
  assert.deepEqual(comparisons.get(11).overall, { slot: 1, average: 85, rank: 1, teams: 3 });
  // Third-best on the roster, behind two higher-valued players at other slots
  assert.deepEqual(comparisons.get(12).overall, { slot: 3, average: 35, rank: 1, teams: 3 });
  // The guard and center places are ranked inside their own positions
  assert.deepEqual(comparisons.get(11).position, { slot: 1, average: 85, rank: 1, teams: 3, group: 'G' });
  assert.deepEqual(comparisons.get(12).position, { slot: 2, average: 45, rank: 2, teams: 3, group: 'G' });
  assert.deepEqual(comparisons.get(13).position, { slot: 1, average: 55, rank: 1, teams: 3, group: 'C' });
  // IR doesn't count, even when it holds the best player
  assert.equal(comparisons.has(14), false);
});

test('a position place with no rival keeps its place but has no average', () => {
  const p = (id, team, position) => ({
    id, team, slot: 0, name: `P${id}`, projectedValue: 10, seasonValue: 10, position,
  });
  const comparisons = slotComparisons([
    { id: 1, players: [p(11, 1, 'C')] },
    { id: 2, players: [p(21, 2, 'G')] },
  ], 'projected');
  // Overall there is a rival at the first slot
  assert.equal(comparisons.get(11).overall.average, 10);
  // But no other team has a center
  assert.deepEqual(comparisons.get(11).position, { slot: 1, group: 'C' });
});
