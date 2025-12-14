// Player info for live scoring
export interface PlayerInfo {
  name: string;
  firstName?: string;
  lastName?: string;
  position: string;
  team?: string;
  gameTime?: string;
  kickoffUTC?: number;
  opponentDisplay?: string;
  score?: string;
  isCompleted?: boolean;
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
