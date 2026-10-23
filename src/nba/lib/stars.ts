// The live season's best (and worst) player-games of a day, among rostered
// players: free agents' lines aren't fetched.
import type { NbaDay, NbaTeam } from './data';
import { CATEGORIES, scoreRoto, type StatLine } from './roto';
import { counts } from './tonight';

export interface StarLine {
  id: number;
  name: string;
  proTeam?: number;
  team: number;
  // Whether it counted (not on the bench or IR)
  active: boolean;
  line: StatLine;
  minutes?: number;
  // Standard deviations above the day's average player-game, summed over
  // the categories; shooting is weighted by attempts
  score: number;
  // Roto points his manager has now that they wouldn't without this line
  // (active lines only)
  swing?: number;
}

export interface CategoryLeader {
  category: number;
  value: number;
  star: StarLine;
  // Others level with the leader
  tied: number;
}

export interface TeamNight {
  team: number;
  // Its active players' scores summed
  score: number;
  best: StarLine;
}

export interface Swing {
  star: StarLine;
  points: number;
}

export interface Stars {
  // Lines that counted, best first
  players: StarLine[];
  leaders: CategoryLeader[];
  // Bench and IR lines good enough to have made the day's top lines
  benchedOff: StarLine[];
  // The worst active line with real minutes behind it
  brick?: StarLine;
  // The active lineup whose players added up to the most (whole league only)
  bestNight?: TeamNight;
  // The lines worth the most roto points to their managers, most first
  swings: Swing[];
}

// Shooting leaders need enough tries to mean something
const MIN_FGA = 8;
const MIN_FTA = 5;
const BRICK_MINUTES = 20;
// How many of the day's best lines are shown. A bench line went off if it
// would have been one of them.
export const TOP_STARS = 5;
const BENCH_SHOWN = 3;
const SWINGS_SHOWN = 5;

const spread = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  return { mean, sd: sd || 1 };
};

export function dayStars(
  day: NbaDay,
  names: Record<string, string>,
  proTeams: Record<string, number>,
  teams: NbaTeam[],
  // One team's lines only, still scored against the whole day
  only?: number,
): Stars | undefined {
  if (!day.players.length) return undefined;
  const lines = day.players.map(([team, id, slot, , ...line]) => ({
    id,
    name: names[id] ?? `Player ${id}`,
    proTeam: day.playedFor?.[id] ?? proTeams[id],
    team,
    active: counts(slot),
    line: line as StatLine,
    minutes: day.playerMinutes?.[id],
  }));

  // Counting stats as they are; FG% and FT% as shots made above the day's
  // average on the same attempts, so 10 for 12 beats 2 for 2
  const sum = (i: number) => lines.reduce((a, p) => a + p.line[i], 0);
  const fg = sum(6) / (sum(7) || 1);
  const ft = sum(8) / (sum(9) || 1);
  const impact = (line: StatLine) => [
    ...[0, 1, 2, 3, 4, 5].map((i) => line[i]),
    line[6] - fg * line[7],
    line[8] - ft * line[9],
  ];
  const impacts = lines.map((p) => impact(p.line));
  const spreads = CATEGORIES.map((_, c) => spread(impacts.map((v) => v[c])));
  const ranked: StarLine[] = lines
    .map((p, i) => ({
      ...p,
      score: impacts[i].reduce((a, v, c) => a + (v - spreads[c].mean) / spreads[c].sd, 0),
    }))
    .filter((p) => only === undefined || p.team === only)
    .sort((a, b) => b.score - a.score);
  // Bench and IR lines don't count, so they only show as their own list
  const players = ranked.filter((p) => p.active);

  const leaders: CategoryLeader[] = [];
  CATEGORIES.forEach((category, c) => {
    const tries = c === 6 ? MIN_FGA : c === 7 ? MIN_FTA : 0;
    const field = players.filter((p) => !tries || p.line[c === 6 ? 7 : 9] >= tries);
    if (!field.length) return;
    const value = (p: StarLine) => category.value(p.line);
    // Level values go to the better all-round line
    const star = field.reduce((best, p) => (value(p) > value(best) ? p : best));
    const top = value(star);
    if (top <= 0) return;
    leaders.push({
      category: c,
      value: top,
      star,
      tied: field.filter((p) => p !== star && value(p) === top).length,
    });
  });

  const bar = players[TOP_STARS - 1]?.score ?? -Infinity;
  const benchedOff = ranked
    .filter((p) => !p.active && p.score > 0 && p.score >= bar)
    .slice(0, BENCH_SHOWN);
  const brick = [...players]
    .reverse()
    .find((p) => p.active && (p.minutes ?? 0) >= BRICK_MINUTES);

  const swingOf = rotoSwing(teams);
  for (const p of players) p.swing = swingOf(p.team, p.line);
  const nights = new Map<number, TeamNight>();
  for (const p of players) {
    const night = nights.get(p.team);
    if (night) night.score += p.score;
    else nights.set(p.team, { team: p.team, score: p.score, best: p });
  }
  const bestNight =
    only === undefined
      ? [...nights.values()].reduce<TeamNight | undefined>(
          (best, n) => (!best || n.score > best.score ? n : best),
          undefined,
        )
      : undefined;

  return {
    swings: players
      .filter((p) => (p.swing ?? 0) > 0)
      .map((star) => ({ star, points: star.swing! }))
      .sort((a, b) => b.points - a.points || b.star.score - a.star.score)
      .slice(0, SWINGS_SHOWN),
    players,
    leaders,
    benchedOff,
    brick: brick && brick.score < 0 ? brick : undefined,
    bestNight,
  };
}

// A line taken back out of its team's season totals (which include it), the
// standings rescored, and the difference in the team's points
function rotoSwing(teams: NbaTeam[]) {
  const totals = new Map(teams.map((t) => [t.id, t.totals]));
  const now = new Map(scoreRoto(totals).map((t) => [t.id, t.points]));
  return (team: number, line: StatLine) => {
    const total = totals.get(team);
    if (!total) return 0;
    const without = new Map(totals).set(
      team,
      total.map((v, i) => v - (line[i] ?? 0)),
    );
    const before = scoreRoto(without).find((t) => t.id === team)?.points ?? 0;
    return (now.get(team) ?? 0) - before;
  };
}
