import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Transpile the pure frontend utility in memory; no test-only browser or
// runtime dependency, and this also works on the project's Node 20 minimum.
import { readFile } from 'node:fs/promises';
const source = await readFile(
  new URL('../src/utils/trades.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const {
  tradeVerdict,
  tradeKicker,
  rankTradeTeams,
  sortTradeTeams,
  tradeTeamRanked,
  tradeWinRate,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const side = (franchiseID, lift, started = 10) => ({
  franchiseID,
  lift,
  started,
  points: started + 5,
  received: [{ games: [{ week: 1 }] }],
});
const trade = (a, b) => ({
  unsupported: false,
  evaluated: true,
  sides: [a, b],
});

test('winner is independent of both-gained and both-lost outcomes', () => {
  assert.deepEqual(tradeVerdict(trade(side('A', 20), side('B', 10)), 'lift'), {
    kind: 'both-gained',
    winner: 'A',
    label: 'Both gained',
  });
  assert.equal(
    tradeVerdict(trade(side('A', -20), side('B', -10)), 'lift').winner,
    'B',
  );
  assert.equal(
    tradeVerdict(trade(side('A', -20), side('B', -10)), 'lift').kind,
    'both-lost',
  );
});

test('production views never claim a profit or reuse the lineup winner', () => {
  const t = trade(side('A', 20, 10), side('B', 10, 50));
  assert.equal(tradeVerdict(t, 'started').winner, 'B');
  assert.equal(tradeVerdict(t, 'started').kind, 'edge');
});

test('ties, pending trades, unknown assets and missing scores have no winner', () => {
  assert.equal(
    tradeVerdict(trade(side('A', 10), side('B', 10)), 'lift').kind,
    'both-gained',
  );
  assert.equal(
    tradeVerdict(trade(side('A', 10), side('B', 10)), 'lift').winner,
    null,
  );
  assert.equal(
    tradeVerdict(trade(side('A', null), side('B', 10)), 'lift').kind,
    'unrated',
  );
  const t = trade(side('A', 0), side('B', 0));
  t.sides.forEach((s) => (s.received[0].games = []));
  assert.equal(tradeVerdict(t, 'lift').kind, 'tie');
  t.evaluated = false;
  assert.equal(tradeVerdict(t, 'lift').kind, 'pending');
  assert.equal(
    tradeVerdict({ ...t, unsupported: true }, 'points').winner,
    null,
  );
});

test('kickers size a win by its margin and name the special outcomes', () => {
  const kick = (a, b) => tradeKicker(trade(side('A', a), side('B', b)), 'lift');
  assert.equal(kick(80, -40), 'Fleeced');
  assert.equal(kick(30, -0.5), 'Clear win');
  assert.equal(kick(15, 0), 'Edge');
  assert.equal(kick(5, 0), 'Coin flip');
  assert.equal(kick(20, 10), 'Win-win');
  assert.equal(kick(-20, -10), 'Lose-lose');
  assert.equal(kick(0, 0), 'Dead even');
  assert.equal(kick(null, 10), 'Unrated');
  assert.equal(
    tradeKicker(
      { ...trade(side('A', 0), side('B', 0)), evaluated: false },
      'lift',
    ),
    'Too early to call',
  );
});

test('team rankings add independent gains, exclude unrated deals and count wins', () => {
  const trades = [
    trade(side('A', 20), side('B', 10)),
    trade(side('A', 5), side('C', 30)),
    trade(side('A', null), side('B', 99)),
  ];
  const rows = rankTradeTeams(trades, 'lift', new Map());
  assert.deepEqual(
    rows.map((t) => [t.id, t.value, t.rated, t.wins]),
    [
      ['C', 30, 1, 1],
      ['A', 25, 2, 1],
      ['B', 10, 1, 0],
    ],
  );
  assert.equal(rows.find((t) => t.id === 'A').trades, 3);
  assert.equal(rows.find((t) => t.id === 'A').losses, 1);
  assert.equal(rows.find((t) => t.id === 'B').losses, 1);
});

test('rate sorts need enough rated deals; the rest follow in total order', () => {
  const trades = [
    trade(side('A', 50), side('B', 10)),
    trade(side('A', 5), side('B', 10)),
    trade(side('A', 5), side('B', 10)),
    trade(side('C', 90), side('D', -5)),
  ];
  const rows = rankTradeTeams(trades, 'lift', new Map());
  assert.deepEqual(
    rows.map((t) => t.id),
    ['C', 'A', 'B', 'D'],
  );
  // B won 2 of 3; A won 1 of 3. C's single deal is too few to rank.
  assert.deepEqual(
    sortTradeTeams(rows, 'winRate').map((t) => t.id),
    ['B', 'A', 'C', 'D'],
  );
  assert.deepEqual(
    sortTradeTeams(rows, 'average').map((t) => t.id),
    ['A', 'B', 'C', 'D'],
  );
  assert.equal(tradeTeamRanked(rows[0], 'winRate'), false);
  assert.equal(tradeWinRate(rows.find((t) => t.id === 'B')), 2 / 3);
});

test('one-cent differences pick a winner despite floating-point representation', () => {
  assert.equal(
    tradeVerdict(trade(side('A', 10), side('B', 10.01)), 'lift').winner,
    'B',
  );
});

test('all-time rankings combine a manager across franchise changes and keep successors separate', () => {
  const first = {
    ...trade(side('madison0002', 20), side('madison0005', 10)),
    season: 2016,
    league: 'madison',
  };
  const second = {
    ...trade(side('madison0010', 30), side('madison0002', 5)),
    season: 2026,
    league: 'madison',
  };
  const managers = new Map([
    ['2016:madison0002', { name: 'Original Manager' }],
    ['2016:madison0005', { name: 'Other Manager' }],
    ['2026:madison0010', { name: 'Original Manager' }],
    ['2026:madison0002', { name: 'Successor' }],
  ]);
  const rows = rankTradeTeams([first, second], 'lift', managers, true);
  const original = rows.find((r) => r.name === 'Original Manager');
  assert.equal(original.value, 50);
  assert.equal(original.trades, 2);
  assert.equal(original.wins, 2);
  assert.deepEqual(original.seasons, [2016, 2026]);
  assert.equal(rows.find((r) => r.name === 'Successor').value, 5);
  assert.equal(rows.length, 3);
});

test('all-time unknown owners remain separate by season rather than sharing a reused franchise', () => {
  const first = {
    ...trade(side('madison0002', 20), side('madison0005', 10)),
    season: 2016,
    league: 'madison',
  };
  const second = {
    ...trade(side('madison0002', 30), side('madison0005', 5)),
    season: 2026,
    league: 'madison',
  };
  const rows = rankTradeTeams([first, second], 'lift', new Map(), true);
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((r) => r.id)).size, 4);
});
