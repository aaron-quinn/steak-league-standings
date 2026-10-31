import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/nba/lib/injuries.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { buildInjuryData, summarizeInjuries } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

const starLine = [30, 10, 8, 4, 2, 1, 10, 20, 6, 7];
const roleLine = [12, 5, 3, 1, 1, 0, 5, 11, 1, 2];

const baseLeague = {
  season: 2026,
  opener: '2025-10-21',
  finalDay: 14,
  latestDay: 14,
  lastDay: 14,
  cutoff: null,
  budget: 200,
  teams: [
    { id: 1, name: 'Team 1', abbrev: 'T1', owner: 'Alice', totals: starLine.map((v) => v * 10), espn: { points: 20, rank: 1 } },
    { id: 2, name: 'Team 2', abbrev: 'T2', owner: 'Bob', totals: roleLine.map((v) => v * 10), espn: { points: 10, rank: 2 } },
  ],
  draft: [
    { pick: 1, team: 1, playerID: 101, price: 45, keeper: false },
    { pick: 2, team: 1, playerID: 102, price: 2, keeper: false },
    { pick: 3, team: 2, playerID: 201, price: 30, keeper: false },
  ],
};

test('whole-roster scope counts starter and IR/bench absences while excluding unplayed $1–$4 stashes', () => {
  // 101: drafted $45 starter who plays day 1, misses day 3 in lineup, moves to IR and misses day 8 & 10
  // 102: drafted $2 unplayed IR stash who misses all 4 games on IR and never plays or starts
  // 201: drafted $30 starter on Team 2 who plays days 1, 3, 8 and misses day 10 in lineup
  const days = [
    {
      day: 1,
      rosters: { 1: [101, 102], 2: [201] },
      slots: { 101: 0, 102: 13, 201: 0 },
      players: [
        [1, 101, 0, 1, ...starLine],
        [2, 201, 0, 1, ...roleLine],
      ],
    },
    {
      day: 3,
      rosters: { 1: [101, 102], 2: [201] },
      slots: { 101: 0, 102: 13, 201: 0 },
      players: [[2, 201, 0, 1, ...roleLine]],
    },
    {
      day: 8,
      rosters: { 1: [101, 102], 2: [201] },
      slots: { 101: 13, 102: 13, 201: 0 },
      players: [[2, 201, 0, 1, ...roleLine]],
    },
    {
      day: 10,
      rosters: { 1: [101, 102], 2: [201] },
      slots: { 101: 13, 102: 13, 201: 0 },
      players: [],
    },
  ];
  const data = buildInjuryData({
    days,
    schedule: { 1: [1, 3, 8, 10] },
    through: 14,
    names: { 101: 'Star One', 102: 'Cheap Stash', 201: 'Role Two' },
    proTeams: { 101: 1, 102: 1, 201: 1 },
    priors: [],
  });

  const rosterSummary = summarizeInjuries(data, baseLeague, { scope: 'roster' });
  const t1 = rosterSummary.teams.find((t) => t.id === 1);
  // 101 has 1 played, 1 lineup miss, 2 IR misses (3 total lost); 102 is excluded
  assert.equal(t1.players.length, 1);
  assert.equal(t1.players[0].player, 101);
  assert.equal(t1.players[0].played, 1);
  assert.equal(t1.players[0].lost, 3);
  assert.equal(t1.players[0].lineup, 1);
  assert.equal(t1.players[0].sidelined, 2);
  assert.equal(t1.players[0].ir, 2);
  assert.equal(t1.players[0].price, 45);

  // Team totals equal the sum of player rows
  for (const t of rosterSummary.teams) {
    const sumLost = t.players.reduce((s, p) => s + p.lost, 0);
    const sumPts = t.players.reduce((s, p) => s + p.points, 0);
    const sumExp = t.players.reduce((s, p) => s + p.expectedPoints, 0);
    const sumLuck = t.players.reduce((s, p) => s + p.luck, 0);
    assert.equal(t.lost, sumLost);
    assert.ok(Math.abs(t.points - sumPts) < 1e-9);
    assert.ok(Math.abs(t.expectedPoints - sumExp) < 1e-9);
    assert.ok(Math.abs(t.luck - sumLuck) < 1e-9);
    assert.ok(Math.abs(t.expectedPoints - t.points - t.luck) < 1e-9);
  }

  // Lineup-only scope counts only the 1 starter miss for 101
  const lineupSummary = summarizeInjuries(data, baseLeague, { scope: 'lineup' });
  const t1Lineup = lineupSummary.teams.find((t) => t.id === 1);
  assert.equal(t1Lineup.lost, 1);
  assert.equal(t1Lineup.lineup, 1);
  assert.equal(t1Lineup.sidelined, 0);
});
