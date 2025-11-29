import { create } from 'zustand';
import type { StandingsData } from '../types/StandingsData';
import type { Player } from '../types/Player';

interface StandingsState {
  year: number;
  standings: StandingsData;
  players: Player[];
  live: boolean;
  setYear: (year: number) => void;
  setStandings: (standings: StandingsData) => void;
  setPlayers: (players: Player[]) => void;
  setLive: (live: boolean) => void;
}

export const useStandingsStore = create<StandingsState>((set) => ({
  year: 2025,
  standings: {},
  players: [],
  live: false,
  setYear: (year) => set({ year }),
  setStandings: (standings) => set({ standings }),
  setPlayers: (players) => set({ players }),
  setLive: (live) => set({ live }),
}));
