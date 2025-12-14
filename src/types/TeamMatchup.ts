import type { PlayerInfo } from './TeamStanding';

type TeamMatchup = {
  franchiseID: string;
  score: string;
  yetToPlay: number;
  inProgress?: number;
  yetToPlayNames?: PlayerInfo[];
  inProgressNames?: PlayerInfo[];
  completedNames?: PlayerInfo[];
  benchedNames?: PlayerInfo[];
};

export default TeamMatchup;
