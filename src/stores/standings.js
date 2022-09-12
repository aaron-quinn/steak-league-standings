import { defineStore } from 'pinia';

export const useStandingsStore = defineStore({
  id: 'standings',
  state: () => ({
    year: 2022,
    standings: {},
    live: false,
  }),
});
