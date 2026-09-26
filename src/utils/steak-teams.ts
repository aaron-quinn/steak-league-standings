import getManagers from '@/data/managers';
import type { MatchupManager } from '@/types/MatchupManager';

// Every team in the given season by franchise ID (e.g. "madison0002"). Teams
// with a `steak` entry for the year are in the steak race.
export function getTeamManagers(year: number): Map<string, MatchupManager> {
  const teams = new Map<string, MatchupManager>();
  getManagers()
    // A steak result recorded without a team has no scores to show
    .filter((manager) => manager.teams[year]?.teamID)
    .forEach((manager) => {
      const teamYear = manager.teams[year];
      const teamID = teamYear.teamID || '';
      const id = `${(teamYear.league || '').toLowerCase()}${teamID}`;
      teams.set(id, {
        id,
        name: manager.name,
        teamID,
        steak: 'steak' in teamYear,
      });
    });
  return teams;
}

// Official steak rank of each steak team: total points, ties by name, the same
// ordering as StandingsList
export function rankSteakTeams(
  teams: Iterable<MatchupManager>,
  pointsByID: (id: string) => number,
): Map<string, number> {
  const ranks = new Map<string, number>();
  [...teams]
    .filter((team) => team.steak)
    .map((team) => ({ ...team, points: pointsByID(team.id) }))
    .sort((a, b) =>
      a.points === b.points
        ? a.name.localeCompare(b.name)
        : b.points - a.points,
    )
    .forEach((team, index) => ranks.set(team.id, index + 1));
  return ranks;
}

export type SteakZone = 'eater' | 'self-buyer' | 'buyer';

// Half the field eats; with an odd count the middle team buys its own. Mirrors
// the steak line in StandingsList.
export function getSteakLine(teamCount: number) {
  return {
    eaters: Math.floor(teamCount / 2),
    selfBuyer: teamCount % 2 !== 0,
  };
}

export function getSteakZone(rank: number, teamCount: number): SteakZone {
  const { eaters, selfBuyer } = getSteakLine(teamCount);
  if (rank <= eaters) return 'eater';
  if (selfBuyer && rank === eaters + 1) return 'self-buyer';
  return 'buyer';
}
