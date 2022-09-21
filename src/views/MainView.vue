<script setup>
import { ref } from 'vue';
import StandingsList from '../components/StandingsList.vue';
import PlayoffLists from '../components/PlayoffLists.vue';
import ChampionsList from '../components/ChampionsList.vue';
import SteakHistory from '../components/SteakHistory.vue';
import LeagueLogo from '../components/LeagueLogo.vue';
import { useStandingsStore } from '../stores/standings';
import api from '../api';
import ViewSwitcher from '../components/ViewSwitcher.vue';
import getDraftResults from '../data/draft-results';

const props = defineProps({
  live: {
    type: Boolean,
    default: false,
  },
});

const store = useStandingsStore();

const year = store.year;
store.live = ref(props.live);

const standingsAPIURL = props.live
  ? `/live-standings/${year}`
  : `/standings/${year}`;
const standings = await api.getData(standingsAPIURL);
store.standings = standings;

const playerListAPIURL = `/points/${year}`;
const playerList = await api.getData(playerListAPIURL);
const draftResults = getDraftResults();

const players = playerList.map((player) => {
  player.draftPrice =
    draftResults.find(
      (result) =>
        result.player === player.name && result.pos === player.position
    )?.cost || 0;
  return player;
});

store.players = players;
</script>

<template>
  <div class="bg-slate-900 py-6 lg:py-10 lg:px-10">
    <div
      class="max-w-8xl m-auto grid grids-cols-2 lg:grid-cols-10 gap-4 lg:gap-10"
    >
      <div class="col-span-1 lg:col-span-3">
        <LeagueLogo />
        <ChampionsList />
        <SteakHistory />
      </div>
      <div class="col-span-1 lg:col-span-7">
        <ViewSwitcher />
        <StandingsList class="mb-8" />
        <div class="flex justify-between">
          <PlayoffLists v-if="!live" />
        </div>
      </div>
    </div>
  </div>
</template>
