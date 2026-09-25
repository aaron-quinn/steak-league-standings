import { create } from 'zustand';
import type { StandingsData } from '../types/StandingsData';
import type { Player } from '../types/Player';

interface StandingsState {
  year: number;
  standings: StandingsData;
  players: Player[];
  live: boolean;
  setYear: (year: number) => void;
  setStandingsSnapshot: (standings: StandingsData, live: boolean) => void;
  setPlayers: (players: Player[]) => void;
}

export const useStandingsStore = create<StandingsState>((set) => ({
  year: 2026,
  standings: {},
  players: [],
  live: false,
  setYear: (year) => set({ year }),
  setStandingsSnapshot: (standings, live) =>
    set((state) =>
      state.standings === standings && state.live === live
        ? state
        : { standings, live },
    ),
  setPlayers: (players) => set({ players }),
}));
