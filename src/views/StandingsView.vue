<script setup>
import { useStandingsStore } from '../stores/standings';
import api from '../api/index.js';
import getManagers from '../data/managers.js';
import StandingsList from '../components/StandingsList.vue';
import PlayoffLists from '../components/PlayoffLists.vue';

const store = useStandingsStore();

const managers = getManagers();
const year = store.year;

const standings = await api.getData(`/standings/${year}`);
console.log(standings);

const steakTeams = managers
  .filter((t) => t.teams[year] && 'steak' in t.teams[year])
  .map((t) => {
    const { league, teamID, division } = t.teams[year];
    const id = `${league.toLowerCase()}${teamID}`;
    const { points, wins, losses, ties } = standings[id];
    return {
      id,
      name: t.name,
      league,
      division,
      teamID,
      points,
      wins,
      losses,
      ties,
      record: `${wins}-${losses}-${ties}`,
    };
  })
  .sort((a, b) => b.points - a.points);
</script>

<template>
  <div class="bg-slate-900 p-10">
    <div class="max-w-8xl m-auto flex">
      <div class="px-6">
        <img
          class="max-w-[250px] mx-auto mb-8"
          src="steak.svg"
          alt="Steak League"
        />
        <h1
          class="text-white text-6xl font-extralight tracking-wide text-center leading-[1.1] mb-8"
        >
          STEAK LEAGUE
        </h1>
      </div>
      <div class="w-full">
        <StandingsList class="mb-8" :steak-teams="steakTeams" />
        <div class="px-10 flex justify-between">
          <PlayoffLists :standings="standings" />
        </div>
      </div>
    </div>
  </div>
</template>
