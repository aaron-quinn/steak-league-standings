// One auction pick and what his season so far has been worth
export interface DraftPick {
  // e.g. "madison0002"
  franchiseID: string;
  id: string;
  name: string;
  position: string;
  team: string;
  price: number;
  points: number;
  // In the league's auction dollars; null until anyone has scored
  worth: number | null;
}

// The points a position's players are measured from
export interface DraftBaseline {
  position: string;
  drafted: number;
  points: number;
}

export interface DraftLeague {
  // "madison" or "la"
  league: string;
  spent: number;
  // Dollars per point above the baseline; null until anyone has scored
  pointPrice: number | null;
  baselines: DraftBaseline[];
  picks: DraftPick[];
}

export interface DraftResults {
  // The last finished week, which the values count through; 0 before any
  week: number;
  leagues: DraftLeague[];
}
