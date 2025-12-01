import type { TeamWithStandings } from './TeamWithStandings';
import type { PlayerInfo } from './TeamStanding';

// Team with gap from steak line
export interface TeamWithGap extends TeamWithStandings {
  gap: string | number;
  gapOperator: string;
  pointsInt: string;
  pointsDec: string | undefined;
  gapInt: string;
  gapDec: string;
  gapNum: number;
  // Live scoring data
  weeklyScore?: number;
  yetToPlay?: number;
  inProgress?: number;
  // Supports both old API (string[]) and new API (PlayerInfo[])
  yetToPlayNames?: (string | PlayerInfo)[];
  inProgressNames?: (string | PlayerInfo)[];
}
