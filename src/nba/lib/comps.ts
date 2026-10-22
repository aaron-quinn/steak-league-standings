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

// Each category counts the same, as in roto: distances are measured in the
// pool's standard deviations for that category
export function compFinder(pool: PlayerPool) {
  const mostGames = Math.max(0, ...pool.players.map((p) => p[1]));
  const players = pool.players
    .filter(([, games, minutes]) => games >= mostGames * MIN_GAMES_SHARE && minutes / games >= MIN_MINUTES)
    .map(([name, games, , ...line]) => ({
      name,
      values: CATEGORIES.map((c) => c.value(line.map((v) => v / games))),
    }));
  const spread = CATEGORIES.map((_, i) => {
    const values = players.map((p) => p.values[i]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length) || 1;
  });

  return (values: number[]): Comp | undefined => {
    let best: Comp | undefined;
    let bestDistance = Infinity;
    for (const player of players) {
      const distance = player.values.reduce(
        (sum, v, i) => sum + ((v - values[i]) / spread[i]) ** 2,
        0,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = player;
      }
    }
    return best;
  };
}
