import type { TeamStanding } from './TeamStanding';

// Standings indexed by team ID (e.g., "madison0002")
export interface StandingsData {
  [teamId: string]: TeamStanding;
}
