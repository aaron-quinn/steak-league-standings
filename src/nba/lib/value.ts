// What a player's production was worth, in roto standings points: how many
// places it moved his team up, category by category. Each category's rate
// ("so many steals per point") comes from how far apart that season's teams
// finished, so a pickup, a trade and an auction buy are measured alike.
import type { NbaDay, NbaLeague } from './data';
import { CATEGORIES, type StatLine } from './roto.ts';

export interface PointRates {
  // Stats per roto point for the six counting categories
  perPoint: number[];
  // FG% and FT%: league rate, average team attempts, percentage per point
  shooting: { rate: number; attempts: number; perPoint: number }[];
}

// Slope of a category's team totals against their order (least squares):
// the stats it takes to pass one more team
function slope(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = (n - 1) / 2;
  const avg = sorted.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  sorted.forEach((v, i) => {
    num += (i - mean) * (v - avg);
    den += (i - mean) ** 2;
  });
  return den ? num / den : 1;
}

export function pointRates(league: NbaLeague): PointRates {
  const totals = league.teams.map((t) => t.totals);
  const perPoint = [0, 1, 2, 3, 4, 5].map((i) =>
    Math.max(slope(totals.map((t) => t[i])), 1e-6),
  );
  const shooting = [
    [6, 7],
    [8, 9],
  ].map(([made, tried], k) => {
    const sumMade = totals.reduce((s, t) => s + t[made], 0);
    const sumTried = totals.reduce((s, t) => s + t[tried], 0);
    return {
      rate: sumTried ? sumMade / sumTried : 0,
      attempts: sumTried / totals.length,
      perPoint: Math.max(slope(totals.map((t) => CATEGORIES[6 + k].value(t))), 1e-6),
    };
  });
  return { perPoint, shooting };
}

// Roto points a stat line adds to a team: counting stats directly; for
// shooting, how far the made shots beat a league-average shooter on the same
// attempts, spread over a team's season of attempts
export function linePoints(line: StatLine, rates: PointRates) {
  return categoryPoints(line, rates).reduce((sum, p) => sum + p, 0);
}

// The same, category by category (CATEGORIES order)
export function categoryPoints(line: StatLine, rates: PointRates) {
  const points = rates.perPoint.map((per, i) => (line[i] ?? 0) / per);
  rates.shooting.forEach(({ rate, attempts, perPoint }, k) => {
    const made = line[6 + 2 * k] ?? 0;
    const tried = line[7 + 2 * k] ?? 0;
    points.push(attempts ? (made - rate * tried) / attempts / perPoint : 0);
  });
  return points;
}

const BENCH = 12;
const IR = 13;

export interface Stint {
  team: number;
  playerID: number;
  // First and last day on that team (inclusive), up to the last counted day
  from: number;
  to: number;
}

// Every active-lineup line, grouped by team and player, built once per season
type Active = { day: number; games: number; line: number[] };
const indexes = new WeakMap<NbaDay[], Map<string, Active[]>>();
function activeLines(days: NbaDay[]) {
  let index = indexes.get(days);
  if (!index) {
    index = new Map();
    for (const d of days) {
      for (const p of d.players) {
        if (p[2] === BENCH || p[2] === IR) continue;
        const key = `${p[0]}:${p[1]}`;
        if (!index.has(key)) index.set(key, []);
        index.get(key)!.push({ day: d.day, games: p[3], line: p.slice(4) });
      }
    }
    indexes.set(days, index);
  }
  return index;
}

// Roto points a player produced for a team in the active lineup over a stint
export function stintPoints(
  days: NbaDay[],
  stint: Stint,
  rates: PointRates,
) {
  const line: StatLine = Array(10).fill(0);
  let games = 0;
  for (const a of activeLines(days).get(`${stint.team}:${stint.playerID}`) ?? []) {
    if (a.day < stint.from || a.day > stint.to) continue;
    games += a.games;
    for (let i = 0; i < 10; i++) line[i] += a.line[i] ?? 0;
  }
  return { points: linePoints(line, rates), games, line };
}

// The last day a player was on a team after joining it: the day before the
// first roster without him (a drop or a trade)
export function leftTeam(
  days: NbaDay[],
  team: number,
  playerID: number,
  after: number,
  lastDay: number,
) {
  for (const d of days) {
    if (d.day <= after || !d.rosters) continue;
    if (d.day > lastDay) break;
    if (!d.rosters[team]?.includes(playerID)) return d.day - 1;
  }
  return lastDay;
}
