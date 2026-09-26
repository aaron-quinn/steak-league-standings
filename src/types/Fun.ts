// One played week's score for every team, by franchise ID
export interface WeeklyScores {
  week: number;
  scores: { [franchiseID: string]: number };
}

export interface PlayerOwner {
  franchiseID: string;
  starter: boolean;
}

// A rostered player's score for one week, with every team that has him
export interface WeekPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  score: number;
  owners: PlayerOwner[];
  // Only known for the week in progress
  gameStatus?: 'yet-to-play' | 'in-progress' | 'completed' | 'unknown';
}

export interface WeekPlayers {
  week: number;
  players: WeekPlayer[];
}

export interface WaiverPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
}

// A player added by a team, through a won blind bid or as a free agent
export interface WaiverPickup {
  franchiseID: string;
  player: WaiverPlayer;
  // Milliseconds since the epoch
  time: number;
  bid: boolean;
  cost: number;
  // First week he could play for the team; null once the season is over
  week: number | null;
  // Who the team let go to make room
  dropped: WaiverPlayer[];
  // The last other team in the league to drop him before this pickup
  droppedBy: string | null;
  // Scored while on the team's roster, and while in its starting lineup
  points: number;
  started: number;
  games: { week: number; score: number; starter: boolean }[];
}

export interface WaiverSeason {
  lastWeek: number;
  // Each team's season bidding budget, by league name
  budgets: { [league: string]: number | null };
  pickups: WaiverPickup[];
}
