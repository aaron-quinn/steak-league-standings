import { defineStore } from 'pinia';

export const useStandingsStore = defineStore({
  id: 'standings',
  state: () => ({
    year: 2023,
    standings: {},
    players: [],
    live: false,
  }),
});
