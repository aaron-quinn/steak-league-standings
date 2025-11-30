// Teams that are close to making the playoffs
export interface BubbleTeam {
  name: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  // Gap to points-based playoff spot (Second Most Points)
  pointsBack: number;
  // Gap to record-based playoff spot (Second Best Record)
  winsBack: number;
  // Points back from record spot holder (for tiebreaker display)
  recordSpotPointsBack: number;
  // Which path this team is closest on
  qualifier: 'points' | 'record';
}
