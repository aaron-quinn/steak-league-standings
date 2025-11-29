import type { TeamYear } from './TeamYear';

// Steak history manager
export interface SteakManager {
  name: string;
  numSteaks: number;
  steaks: (boolean | undefined)[];
  missedSteaks: TeamYear[];
  steaksWidth: string;
}
