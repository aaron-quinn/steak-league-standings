export interface MatchupManager {
  id: string;
  name: string;
  teamID: string;
  steak: boolean;
  // Official steak rank; undefined for non-steak teams or before standings load
  rank?: number;
}
