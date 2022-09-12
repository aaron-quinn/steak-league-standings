<script setup>
import { toRaw } from 'vue';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import getPlayoffSlots from '../utils/get-playoff-slots';
import PlayoffList from './PlayoffList.vue';

const props = defineProps({
  standings: Object,
});

const managers = getManagers();
const { year, standings } = useStandingsStore();

const managersWithPts = managers
  .filter((t) => t.teams[year])
  .map((m) => {
    const { league, division, teamID } = m.teams[year];
    const team = `${league.toLowerCase()}${teamID}`;
    const { points, wins, losses, ties } = toRaw(standings)[team];
    return {
      name: m.name,
      league,
      division,
      points,
      wins,
      losses,
      ties,
    };
  });

const madisonTeams = managersWithPts.filter((t) => t.league === 'Madison');
const laTeams = managersWithPts.filter((t) => t.league === 'LA');

const playoffsMadison = Object.entries(
  getPlayoffSlots({
    leagueData: madisonTeams,
    divisionName1: 'Au Poivre',
    divisionName2: 'Filet Mignon',
  })
);

const playoffsLA = Object.entries(
  getPlayoffSlots({
    leagueData: laTeams,
    divisionName1: 'Taylors',
    divisionName2: 'Tornado Room',
  })
);
</script>

<template>
  <div class="flex flex-wrap w-full gap-6">
    <PlayoffList :playoff-teams="playoffsMadison" league="Madison" />
    <PlayoffList :playoff-teams="playoffsLA" league="LA" />
  </div>
</template>
