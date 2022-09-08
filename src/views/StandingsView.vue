<script setup>
import { ref } from 'vue';
import { useStandingsStore } from '../stores/standings';
import api from '../api/index.js';
import getManagers from '../data/managers.js';
import StandingsList from '../components/StandingsList.vue';

const store = useStandingsStore();

const managers = getManagers();
const year = store.year;

const standings = await api.getData('/standings/2021');

console.log(managers);

const steakTeams = managers
  .filter((t) => t.teams[year] && 'steak' in t.teams[year])
  .map((t) => {
    const { league, teamID, division } = t.teams[year];
    const id = `${league.toLowerCase()}${teamID}`;
    return {
      id,
      name: t.name,
      league,
      division,
      teamID,
      points: standings[id].points,
    };
  })
  .sort((a, b) => b.points - a.points);
</script>

<template>
  <div class="bg-slate-900 p-10">
    <div class="max-w-7xl m-auto flex">
      <div class="px-10">
        <img
          class="max-w-[160px] mx-auto mb-8"
          src="steak.svg"
          alt="Steak League"
        />
        <h1
          class="text-white text-4xl font-extralight tracking-wide text-center"
        >
          THE STEAK LEAGUE
        </h1>
      </div>
      <StandingsList :steak-teams="steakTeams" />
    </div>
  </div>
</template>
