// What the live season's latest day is doing to the standings: rank moves
// since the day began, and each team's players with games that day.
import type { NbaDay, NbaGame, NbaTeam } from './data';
import { emptyLine, type StatLine } from './roto';
import { buildStandings } from './standings';

// Lineup slots that don't count (worker/nba/config.js)
const BENCH = 12;
const IR = 13;
export const counts = (slot: number) => slot !== BENCH && slot !== IR;

// How many places each team has climbed (positive) or fallen today. The
// totals include today's games, so taking them back out gives the standings
// as the day began. Uses the shared rank, so a tie broken by name isn't a move.
export function rankMoves(teams: NbaTeam[], day: NbaDay | undefined) {
  const moves = new Map<number, number>();
  if (!day?.teams || !day.players.length) return moves;
  const before = new Map(
    teams.map((t) => {
      const today = day.teams![t.id] ?? emptyLine();
      return [t.id, t.totals.map((v, i) => v - (today[i] ?? 0))];
    }),
  );
  // On opening night everyone starts level, so there's nothing to move from
  if (![...before.values()].some((line) => line.some((v) => v > 0))) return moves;
  const start = new Map(buildStandings(teams, before).map((r) => [r.team.id, r.rank]));
  for (const row of buildStandings(teams)) {
    moves.set(row.team.id, (start.get(row.team.id) ?? row.rank) - row.rank);
  }
  return moves;
}

export interface TonightPlayer {
  id: number;
  name: string;
  proTeam?: number;
  slot: number;
  // Whether the player's stats count (not on the bench or IR)
  active: boolean;
  game: NbaGame;
  // The day's stat line, once the player has got on the court
  line?: StatLine;
}

export interface TonightTeam {
  players: TonightPlayer[];
  // The day's stat line from the active lineup: what counts toward the totals
  total: StatLine;
  // Active players whose game hasn't started, is being played, or is over
  toPlay: number;
  playing: number;
  done: number;
}

// Each team's players with a game today, active ones first, by tip-off
export function tonightByTeam(
  day: NbaDay | undefined,
  games: NbaGame[],
  names: Record<string, string>,
  proTeams: Record<string, number>,
) {
  const byTeam = new Map<number, TonightTeam>();
  if (!day?.rosters) return byTeam;
  const lines = new Map(day.players.map((p) => [p[1], p.slice(4) as StatLine]));
  const gameOf = new Map<number, NbaGame>();
  for (const game of games) {
    gameOf.set(game.home, game);
    gameOf.set(game.away, game);
  }
  for (const [teamID, roster] of Object.entries(day.rosters)) {
    const team: TonightTeam = {
      players: [],
      total: day.teams?.[teamID] ?? emptyLine(),
      toPlay: 0,
      playing: 0,
      done: 0,
    };
    for (const id of roster) {
      const proTeam = proTeams[id];
      const game = proTeam === undefined ? undefined : gameOf.get(proTeam);
      if (!game) continue;
      const slot = day.slots?.[id] ?? 0;
      const active = counts(slot);
      team.players.push({
        id,
        name: names[id] ?? `Player ${id}`,
        proTeam,
        slot,
        active,
        game,
        line: lines.get(id),
      });
      if (!active) continue;
      if (game.state === 'pre') team.toPlay++;
      else if (game.state === 'in') team.playing++;
      else team.done++;
    }
    team.players.sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        a.game.start.localeCompare(b.game.start) ||
        a.name.localeCompare(b.name),
    );
    byTeam.set(Number(teamID), team);
  }
  return byTeam;
}
