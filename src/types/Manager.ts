import type { TeamYear } from './TeamYear';

// Manager data structure
export interface Manager {
  name: string;
  teams: {
    [year: number]: TeamYear;
  };
}
