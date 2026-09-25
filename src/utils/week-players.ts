import type { WeekPlayer } from '@/types/Fun';
import type { MatchupsData } from '@/types/MatchupsData';

// The live matchups in the same shape as a played week's players, so the week
// in progress can be ranked alongside the finished ones
export function playersFromMatchups(matchups: MatchupsData): WeekPlayer[] {
  const byID = new Map<string, WeekPlayer>();
  matchups.flat().forEach((team) => {
    team.players.forEach((player) => {
      const id = String(player.mflPlayerID);
      const entry = byID.get(id) ?? {
        id,
        name: player.name,
        position: player.position,
        team: player.team,
        score: Number(player.score) || 0,
        owners: [],
        gameStatus: player.gameStatus,
      };
      entry.owners.push({
        franchiseID: team.franchiseID,
        starter: player.isStarter,
      });
      byID.set(id, entry);
    });
  });
  return [...byID.values()].sort((a, b) => b.score - a.score);
}

export const POSITION_FILTERS = [
  { value: 'all', label: 'All', positions: [] },
  { value: 'QB', label: 'QB', positions: ['QB'] },
  { value: 'RB', label: 'RB', positions: ['RB'] },
  { value: 'WR', label: 'WR', positions: ['WR'] },
  { value: 'TE', label: 'TE', positions: ['TE'] },
  { value: 'K', label: 'K', positions: ['TMPK', 'PK', 'K'] },
  { value: 'DL', label: 'DL', positions: ['DE', 'DT', 'DL'] },
  { value: 'LB', label: 'LB', positions: ['LB'] },
  { value: 'DB', label: 'DB', positions: ['CB', 'S', 'DB'] },
] as const;

export type PositionFilter = (typeof POSITION_FILTERS)[number]['value'];

export function matchesPosition(filter: PositionFilter, position: string) {
  const { positions } = POSITION_FILTERS.find((f) => f.value === filter)!;
  return (
    positions.length === 0 ||
    (positions as readonly string[]).includes(position)
  );
}

// MFL calls the league's team kickers TMPK
export function positionLabel(position: string) {
  return matchesPosition('K', position) ? 'K' : position;
}
