import type { TeamYear } from './TeamYear';

// Team with calculated standings info
export interface TeamWithStandings {
  id: string;
  name: string;
  league: string;
  division: string;
  teamID: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  record: string;
  teams: { [year: number]: TeamYear };
}
