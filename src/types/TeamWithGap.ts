import type { TeamWithStandings } from './TeamWithStandings';

// Team with gap from steak line
export interface TeamWithGap extends TeamWithStandings {
  gap: string | number;
  gapOperator: string;
  pointsInt: string;
  pointsDec: string | undefined;
  gapInt: string;
  gapDec: string;
  gapNum: number;
}
