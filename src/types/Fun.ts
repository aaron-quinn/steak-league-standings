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
