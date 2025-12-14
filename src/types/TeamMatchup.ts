interface PlayerInfo {
  mflPlayerID: number;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  team: string;
  score: string;
  isStarter: boolean;
  isCompleted?: boolean;
  inProgress?: boolean;
  gameStatus: 'yet-to-play' | 'in-progress' | 'completed' | 'unknown';
  gameInfo: {
    kickoff: number;
    isHome: boolean;
    opponentTeam: string;
    gameSecondsRemaining: number;
    hasPossession: boolean;
    inRedZone: boolean;
    score: string;
    quarter?: string;
    quarterTime?: string;
    opponentDisplay: string;
  };
}

type TeamMatchup = {
  franchiseID: string;
  score: string;
  yetToPlay: number;
  inProgress: number;
  completed: number;
  players: PlayerInfo[];
};

export type { PlayerInfo };
export default TeamMatchup;
