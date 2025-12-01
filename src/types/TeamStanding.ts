// Player info for live scoring
export interface PlayerInfo {
  name: string;
  position: string;
  gameTime?: string;
}

// Team data from API standings response
export interface TeamStanding {
  points: number;
  wins: number;
  losses: number;
  ties: number;
  // Live scoring data
  weeklyScore?: number;
  yetToPlay?: number;
  inProgress?: number;
  // Supports both old API (string[]) and new API (PlayerInfo[])
  yetToPlayNames?: (string | PlayerInfo)[];
  inProgressNames?: (string | PlayerInfo)[];
}
