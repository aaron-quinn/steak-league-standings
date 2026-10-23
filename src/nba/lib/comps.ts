// The NBA player whose per-game line looks most like a fantasy team's, for the
// categories standings. A team's per-game line is per game played by its
// active lineup, so it is a player-game too.
import { CATEGORIES, type StatLine } from './roto.ts';

// worker/nba/espn.js compactPlayers: [name, games, minutes, ...stat line]
export type PoolPlayer = [string, number, number, ...StatLine];
export interface PlayerPool {
  season: number;
  players: PoolPlayer[];
}

export interface Comp {
  name: string;
  // The player's value in each category, per game
  values: number[];
}

// Rotation players only: deep-bench lines are tiny, and their percentages
// come from a handful of shots
const MIN_MINUTES = 15;
const MIN_GAMES_SHARE = 0.25;

// Each category's mean and standard deviation over a set of lines
function spreads(lines: number[][]) {
  return CATEGORIES.map((_, i) => {
    const values = lines.map((line) => line[i]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
    return { mean, sd: sd || 1 };
  });
}

// Matches on shape, not size: a team's line averages about ten players, so
// every team sits close to the same balanced starter, and the nearest player
// to that one point won most of the league. Instead each team is placed
// against the other teams (how many of their standard deviations above or
// below in each category) and each player against the other players, so a
// team that leads the league in blocks gets a player who leads players in
// them. Each category counts the same, as in roto.
export function findComps(pool: PlayerPool, teams: Map<number, number[]>) {
  const mostGames = Math.max(0, ...pool.players.map((p) => p[1]));
  const players = pool.players
    .filter(([, games, minutes]) => games >= mostGames * MIN_GAMES_SHARE && minutes / games >= MIN_MINUTES)
    .map(([name, games, , ...line]) => ({
      name,
      values: CATEGORIES.map((c) => c.value(line.map((v) => v / games))),
    }));
  const comps = new Map<number, Comp>();
  if (!players.length || !teams.size) return comps;

  const standardize = (values: number[], by: { mean: number; sd: number }[]) =>
    values.map((v, i) => (v - by[i].mean) / by[i].sd);
  const playerSpread = spreads(players.map((p) => p.values));
  const shapes = players.map((p) => standardize(p.values, playerSpread));
  const teamSpread = spreads([...teams.values()]);

  for (const [id, values] of teams) {
    const shape = standardize(values, teamSpread);
    let best = 0;
    let bestDistance = Infinity;
    shapes.forEach((player, i) => {
      const distance = player.reduce((sum, v, c) => sum + (v - shape[c]) ** 2, 0);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    comps.set(id, players[best]);
  }
  return comps;
}
