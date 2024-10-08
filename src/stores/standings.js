import { defineStore } from 'pinia';

export const useStandingsStore = defineStore({
  id: 'standings',
  state: () => ({
    year: 2024,
    standings: {},
    players: [],
    live: false,
  }),
});
