import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestLineup,
  parseTrades,
  valueTrades,
  weeklyRosterScores,
} from './trade-value.js';

const players = new Map([
  ['r1', { name: 'Received RB', position: 'RB' }],
  ['r2', { name: 'Sent RB', position: 'RB' }],
  ['w1', { name: 'Received WR', position: 'WR' }],
  ['w2', { name: 'Sent WR', position: 'WR' }],
]);
const rules = {
  count: '2',
  position: [
    { name: 'RB', limit: '1' },
    { name: 'WR', limit: '1' },
  ],
};
const starts = [
  { week: 1, time: 1000 },
  { week: 2, time: 2000 },
  { week: 3, time: 3000 },
  { week: 4, time: 4000 },
];
const trade = {
  id: 'deal',
  league: 'la',
  time: 500,
  sides: [
    { franchiseID: 'laA', received: ['w1'], sent: ['r1'] },
    { franchiseID: 'laB', received: ['r1'], sent: ['w1'] },
  ],
};
const roster = (id, score, starter = true) => ({ id, score, starter });
function evaluate(overrides = {}) {
  const weeks = [
    {
      week: 1,
      teams: {
        laA: { players: [roster('r2', 20), roster('w1', 20)] },
        laB: { players: [roster('r1', 20), roster('w2', 20)] },
      },
    },
  ];
  return valueTrades({
    trades: [trade],
    departures: [],
    weeks,
    starts,
    players,
    rules,
    scores: weeklyRosterScores(weeks, 'la'),
    ...overrides,
  })[0];
}

test('only accepted trades are parsed, in chronological order, with singleton support', () => {
  const accepted = {
    type: 'TRADE',
    timestamp: '2',
    franchise: 'A',
    franchise2: 'B',
    franchise1_gave_up: 'r1,',
    franchise2_gave_up: 'w1,',
  };
  assert.equal(
    parseTrades({ ...accepted, type: 'TRADE_PROPOSAL' }, 'la').length,
    0,
  );
  assert.deepEqual(parseTrades(accepted, 'la')[0].sides, trade.sides);
  assert.deepEqual(
    parseTrades([accepted, { ...accepted, timestamp: '1' }], 'la').map(
      (t) => t.time,
    ),
    [1000, 2000],
  );
});

test('lineup solver observes flex capacity and shared defensive positions', () => {
  const rules = {
    count: '4',
    position: [
      { name: 'RB', limit: '1-2' },
      { name: 'WR', limit: '1-2' },
      { name: 'DT+DE', limit: '1' },
    ],
  };
  const pos = { a: 'RB', b: 'RB', c: 'WR', d: 'WR', e: 'DE', f: 'DT' };
  const ps = [
    roster('a', 30),
    roster('b', 25),
    roster('c', 20),
    roster('d', 5),
    roster('e', 15),
    roster('f', 10),
  ];
  assert.equal(
    bestLineup(ps, rules, (id) => pos[id]),
    90,
  );
});

test('both teams can profit by trading surplus for a position of need', () => {
  const result = evaluate();
  assert.deepEqual(
    result.sides.map((s) => s.lift),
    [20, 20],
  );
  assert.deepEqual(
    result.sides.map((s) => s.started),
    [20, 20],
  );
});

test('lineup lift can be negative and does not equal the received point total', () => {
  const weeks = [
    {
      week: 1,
      teams: {
        laA: { players: [roster('w1', 5), roster('w2', 10)] },
        laB: { players: [roster('r1', 30)] },
      },
    },
  ];
  const result = evaluate({ weeks, scores: weeklyRosterScores(weeks, 'la') });
  assert.equal(result.sides[0].lift, -30);
  assert.equal(result.sides[0].points, 5);
});

test('bench production counts as roster points but not started points', () => {
  const weeks = [
    {
      week: 1,
      teams: {
        laA: { players: [roster('w1', 25, false)] },
        laB: { players: [roster('r1', 20)] },
      },
    },
  ];
  const result = evaluate({ weeks, scores: weeklyRosterScores(weeks, 'la') });
  assert.equal(result.sides[0].points, 25);
  assert.equal(result.sides[0].started, 0);
});

test('excludes partial trade week and never credits a later reacquisition', () => {
  const weeks = [1, 2, 3, 4].map((week) => ({
    week,
    teams: {
      laA: { players: [roster('w1', 10)] },
      laB: { players: [roster('r1', 10)] },
    },
  }));
  const result = evaluate({
    trades: [{ ...trade, time: 1500 }],
    weeks,
    departures: [{ franchiseID: 'laA', playerID: 'w1', time: 2500 }],
    scores: weeklyRosterScores(weeks, 'la'),
  });
  assert.deepEqual(
    result.sides[0].received[0].games.map((g) => g.week),
    [2],
  );
  assert.equal(result.sides[0].points, 10);
});

test('missing counterfactual scores are unrated instead of silently zero', () => {
  const result = evaluate({ scores: new Map() });
  assert.equal(result.sides[0].lift, null);
  assert.equal(result.sides[0].impact[0].withoutTrade, null);
  assert.equal(result.sides[0].started, 20);
});

test('non-player assets are preserved and leave the full trade unrated', () => {
  const result = evaluate({
    trades: [
      {
        ...trade,
        sides: [{ ...trade.sides[0], sent: ['DP_2027_1'] }, trade.sides[1]],
      },
    ],
  });
  assert.equal(result.unsupported, true);
  assert.equal(result.sides[0].lift, null);
  assert.equal(result.sides[1].lift, null);
});

test('no scored weeks means no lineup rating, including post-season trades', () => {
  assert.equal(evaluate({ weeks: [] }).sides[0].lift, null);
  const result = evaluate({ trades: [{ ...trade, time: 5000 }] });
  assert.equal(result.week, null);
  assert.equal(result.sides[0].points, 0);
});

test('scores use the trading league even if the other league owns the player', () => {
  const scores = weeklyRosterScores(
    [
      {
        week: 1,
        teams: {
          laA: { players: [roster('r1', 20)] },
          madisonA: { players: [roster('r1', 99)] },
        },
      },
    ],
    'la',
  );
  assert.equal(scores.get(1).get('r1'), 20);
});

test('taxi-only acquired players earn zero realized lift once the season is scored', () => {
  const weeks = [
    {
      week: 1,
      teams: { laA: { players: [] }, laB: { players: [roster('r1', 20)] } },
    },
  ];
  const result = evaluate({ weeks, scores: weeklyRosterScores(weeks, 'la') });
  assert.equal(result.sides[0].lift, 0);
  assert.equal(result.sides[0].points, 0);
});

test('2026 Friday Kincaid/Brown trade counts their Sunday Week 4 games', () => {
  const tradeTime = Date.parse('2026-10-02T15:21:38Z');
  const kickoff = Date.parse('2026-10-04T17:00:00Z');
  const trade = {
    id: 'kincaid-brown',
    league: 'madison',
    time: tradeTime,
    sides: [
      { franchiseID: 'madison0005', received: ['16213'], sent: ['14104'] },
      { franchiseID: 'madison0008', received: ['14104'], sent: ['16213'] },
    ],
  };
  const weeks = [
    {
      week: 4,
      teams: {
        madison0005: { players: [roster('16213', 1.2)] },
        madison0008: { players: [roster('14104', 0, false)] },
      },
    },
  ];
  const result = valueTrades({
    trades: [trade],
    departures: [],
    weeks,
    starts: [
      {
        week: 4,
        time: Date.parse('2026-10-02T00:15:00Z'),
        end: Date.parse('2026-10-06T00:15:00Z'),
        kickoffs: { BUF: kickoff, NEP: kickoff },
      },
    ],
    players: new Map([
      ['16213', { name: 'Dalton Kincaid', position: 'TE', team: 'BUF' }],
      ['14104', { name: 'A.J. Brown', position: 'WR', team: 'NEP' }],
    ]),
    rules: {
      count: '2',
      position: [
        { name: 'TE', limit: '1' },
        { name: 'WR', limit: '1' },
      ],
    },
    scores: weeklyRosterScores(weeks, 'madison'),
  })[0];
  assert.equal(result.week, 4);
  assert.equal(result.evaluated, true);
  assert.deepEqual(
    result.sides.map((s) => s.started),
    [1.2, 0],
  );
  assert.deepEqual(
    result.sides.map((s) => s.received[0].games[0].week),
    [4, 4],
  );
});

const midweekSchedule = [
  { week: 1, time: 1000, end: 1900, kickoffs: { THU: 1000, SUN: 1800 } },
  { week: 2, time: 2000, end: 2900, kickoffs: { THU: 2000, SUN: 2800 } },
];
const scheduledPlayers = (teams = {}) =>
  new Map(
    [...players].map(([id, player]) => [
      id,
      { ...player, team: teams[id] ?? 'SUN' },
    ]),
  );

test('a game before a Friday trade cannot count as acquired production or a sent-player loss', () => {
  const result = evaluate({
    trades: [{ ...trade, time: 1500 }],
    starts: midweekSchedule,
    players: scheduledPlayers({ w1: 'THU' }),
  });
  assert.equal(result.sides[0].points, 0);
  assert.equal(result.sides[1].started, 20);
  // The Thursday player stays unchanged instead of being restored to B.
  assert.equal(result.sides[1].impact[0].withoutTrade, 20);
  assert.equal(result.sides[1].lift, 20);
});

test('departure before Sunday excludes that game, but a departure after kickoff retains it', () => {
  const before = evaluate({
    starts: midweekSchedule,
    players: scheduledPlayers(),
    departures: [{ franchiseID: 'laA', playerID: 'w1', time: 1700 }],
  });
  const after = evaluate({
    starts: midweekSchedule,
    players: scheduledPlayers(),
    departures: [{ franchiseID: 'laA', playerID: 'w1', time: 1850 }],
  });
  assert.equal(before.sides[0].points, 0);
  assert.equal(after.sides[0].points, 20);
});

test('received pre-trade points cannot mask the loss of an eligible Sunday player', () => {
  const weeks = [
    {
      week: 1,
      teams: {
        laA: { players: [roster('r2', 0), roster('w1', 40)] },
        laB: { players: [roster('r1', 20), roster('w2', 20)] },
      },
    },
  ];
  const result = evaluate({
    weeks,
    scores: weeklyRosterScores(weeks, 'la'),
    trades: [{ ...trade, time: 1500 }],
    starts: midweekSchedule,
    players: scheduledPlayers({ w1: 'THU' }),
  });
  assert.equal(result.sides[0].points, 0);
  assert.equal(result.sides[0].impact[0].withTrade, 0);
  assert.equal(result.sides[0].impact[0].withoutTrade, 20);
  assert.equal(result.sides[0].lift, -20);
});

// 2016 waiver exports use added/dropped instead of the later pipe format.
import { parseRosterMoves } from './roster-moves.js';

test('a legacy waiver drop ends a traded-player stint before any later reacquisition', () => {
  const moves = parseRosterMoves(
    [
      {
        type: 'WAIVER',
        timestamp: '1.5',
        franchise: 'A',
        added: 'r2,',
        dropped: 'w1,',
      },
      {
        type: 'FREE_AGENT',
        timestamp: '2.5',
        franchise: 'A',
        transaction: 'w1,|',
      },
    ],
    'la',
  );
  assert.equal(moves.departures[0].playerID, 'w1');
  assert.equal(moves.pickups[0].playerID, 'r2');
  const weeks = [1, 2, 3].map((week) => ({
    week,
    teams: {
      laA: { players: [roster('w1', 10)] },
      laB: { players: [roster('r1', 20)] },
    },
  }));
  const result = evaluate({
    weeks,
    departures: moves.departures,
    scores: weeklyRosterScores(weeks, 'la'),
  });
  assert.deepEqual(
    result.sides[0].received[0].games.map((g) => g.week),
    [1],
  );
});

test('modern blind bids, free agents and trades still produce the same exits', () => {
  const moves = parseRosterMoves(
    [
      {
        type: 'TRADE',
        timestamp: '3',
        franchise: 'A',
        franchise2: 'B',
        franchise1_gave_up: 'r1,',
        franchise2_gave_up: 'w1,',
      },
      {
        type: 'FREE_AGENT',
        timestamp: '2',
        franchise: 'A',
        transaction: 'w2,|r2,',
      },
      {
        type: 'BBID_WAIVER',
        timestamp: '1',
        franchise: 'A',
        transaction: 'r2,w2,|12.00|r1,',
      },
    ],
    'la',
  );
  assert.deepEqual(
    moves.pickups.map((p) => p.cost),
    [12, 0, 0],
  );
  assert.deepEqual(
    moves.departures.map((p) => [p.franchiseID, p.playerID, p.drop]),
    [
      ['laA', 'r1', true],
      ['laA', 'r2', true],
      ['laA', 'r1', false],
      ['laB', 'w1', false],
    ],
  );
});
