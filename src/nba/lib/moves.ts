import type { NbaDay, NbaLeague, Transaction } from './data';
// Explicit extensions so scripts/nba/build-seasons.mjs can load this in Node
import { personName } from './standings.ts';
import { leftTeam, pointRates, stintPoints, type PointRates } from './value.ts';

const nameOf = (names: Record<string, string>, id: number) =>
  names[id] ?? `Player ${id}`;

function owners(league: NbaLeague) {
  return new Map(league.teams.map((t) => [t.id, personName(t)]));
}

export interface DraftRow {
  pick: number;
  playerID: number;
  player: string;
  team: number;
  owner: string;
  price: number;
  points: number;
  games: number;
  // Points beyond what picks at that price produced on average
  surplus: number;
}

export function buildDraft(
  league: NbaLeague,
  days: NbaDay[],
  names: Record<string, string>,
  rates: PointRates = pointRates(league),
): DraftRow[] {
  const who = owners(league);
  const rows = league.draft.map((pick) => {
    const to = leftTeam(days, pick.team, pick.playerID, 0, league.lastDay);
    const { points, games } = stintPoints(
      days,
      { team: pick.team, playerID: pick.playerID, from: 1, to },
      rates,
    );
    return {
      pick: pick.pick,
      playerID: pick.playerID,
      player: nameOf(names, pick.playerID),
      team: pick.team,
      owner: who.get(pick.team) ?? '',
      price: pick.price,
      points,
      games,
      surplus: 0,
    };
  });

  // Expected points for a price: a straight line through every pick
  const n = rows.length;
  if (n > 1) {
    const mx = rows.reduce((s, r) => s + r.price, 0) / n;
    const my = rows.reduce((s, r) => s + r.points, 0) / n;
    let num = 0;
    let den = 0;
    for (const r of rows) {
      num += (r.price - mx) * (r.points - my);
      den += (r.price - mx) ** 2;
    }
    const b = den ? num / den : 0;
    for (const r of rows) r.surplus = r.points - (my + b * (r.price - mx));
  }
  return rows;
}

export interface Pickup {
  day: number;
  at: number;
  playerID: number;
  player: string;
  team: number;
  owner: string;
  type: 'WAIVER' | 'FREEAGENT';
  bid: number;
  // Days on the team and roto points added while active
  held: number;
  points: number;
  games: number;
}

export function buildPickups(
  league: NbaLeague,
  days: NbaDay[],
  names: Record<string, string>,
  rates: PointRates = pointRates(league),
): Pickup[] {
  const who = owners(league);
  const out: Pickup[] = [];
  for (const d of days) {
    if (d.day > league.lastDay) break;
    for (const t of d.tx) {
      if (t.type === 'TRADE') continue;
      for (const [kind, pid] of t.items) {
        if (kind !== 'ADD') continue;
        const to = leftTeam(days, t.team, pid, d.day, league.lastDay);
        const { points, games } = stintPoints(days, { team: t.team, playerID: pid, from: d.day, to }, rates);
        out.push({
          day: d.day,
          at: t.at,
          playerID: pid,
          player: nameOf(names, pid),
          team: t.team,
          owner: who.get(t.team) ?? '',
          type: t.type as Pickup['type'],
          bid: t.type === 'WAIVER' ? t.bid : 0,
          held: to - d.day + 1,
          points,
          games,
        });
      }
    }
  }
  return out;
}

export interface TradeSide {
  team: number;
  owner: string;
  // Players this team received, and what each produced for it afterwards
  received: { playerID: number; player: string; points: number; games: number }[];
  points: number;
}

export interface Trade {
  day: number;
  at: number;
  sides: TradeSide[];
  // Roto points between the two sides (positive: the first side won)
  margin: number;
}

// [playerID, from team, to team]
type Move = [number, number, number];

// ESPN's accepted trades don't list their players, so read trades off the
// rosters: players who went straight from one team to another overnight,
// without a waiver or free-agent add, close to an accepted trade
export function inferTrades(days: NbaDay[]): { day: number; at: number; moves: Move[] }[] {
  const accepted = days.flatMap((d) =>
    (d.tx as Transaction[]).filter((t) => t.type === 'TRADE').map((t) => ({ day: d.day, at: t.at })),
  );
  const trades: { day: number; at: number; moves: Move[] }[] = [];
  let teamOf = new Map<number, number>();
  let lastRosterDay = 0;
  const added = new Set<string>();
  for (const d of days) {
    for (const t of d.tx) {
      for (const [kind, pid] of t.items) if (kind === 'ADD') added.add(`${t.team}:${pid}`);
    }
    if (!d.rosters) continue;
    const now = new Map<number, number>();
    for (const [team, ids] of Object.entries(d.rosters)) {
      for (const pid of ids) now.set(pid, Number(team));
    }
    const moves: Move[] = [];
    for (const [pid, to] of now) {
      const from = teamOf.get(pid);
      if (from !== undefined && from !== to && !added.has(`${to}:${pid}`)) moves.push([pid, from, to]);
    }
    if (moves.length && teamOf.size) {
      const accept = accepted.find((a) => a.day >= lastRosterDay - 1 && a.day <= d.day);
      // One trade per pair of teams
      const pairs = new Map<string, Move[]>();
      for (const m of moves) {
        const key = [m[1], m[2]].sort().join('-');
        pairs.set(key, [...(pairs.get(key) ?? []), m]);
      }
      if (accept) {
        for (const group of pairs.values()) trades.push({ day: d.day, at: accept.at, moves: group });
      }
    }
    teamOf = now;
    lastRosterDay = d.day;
    added.clear();
  }
  return trades;
}

export function buildTrades(
  league: NbaLeague,
  days: NbaDay[],
  names: Record<string, string>,
  rates: PointRates = pointRates(league),
): Trade[] {
  const who = owners(league);
  const trades: Trade[] = [];
  for (const { day, at, moves } of inferTrades(days)) {
    if (day > league.lastDay) break;
    const teams = [...new Set(moves.map(([, , to]) => to))];
    const sides = teams.map((team) => {
      const received = moves
        .filter(([, , to]) => to === team)
        .map(([pid]) => {
          const to = leftTeam(days, team, pid, day, league.lastDay);
          const { points, games } = stintPoints(days, { team, playerID: pid, from: day, to }, rates);
          return { playerID: pid, player: nameOf(names, pid), points, games };
        });
      return {
        team,
        owner: who.get(team) ?? '',
        received,
        points: received.reduce((s, r) => s + r.points, 0),
      };
    });
    sides.sort((a, b) => b.points - a.points);
    trades.push({
      day,
      at,
      sides,
      margin: sides.length > 1 ? sides[0].points - sides[1].points : 0,
    });
  }
  return trades;
}
