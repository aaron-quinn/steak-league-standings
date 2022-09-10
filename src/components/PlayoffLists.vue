<script setup>
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import getPlayoffSlots from '../utils/get-playoff-slots';
import PlayoffList from './PlayoffList.vue';

const props = defineProps({
  standings: Object,
});

const results = { ...props.standings };

const managers = getManagers();
const { year } = useStandingsStore();

const managersWithPts = managers
  .filter((t) => t.teams[year])
  .map((m) => {
    const { league, division, teamID } = m.teams[year];
    const team = `${league.toLowerCase()}${teamID}`;
    const { points, wins, losses, ties } = results[team];
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
console.log(madisonTeams);
console.log(laTeams);

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

console.log(playoffsMadison);
console.log(playoffsLA);
</script>

<template>
  <div class="flex flex-wrap w-full gap-6">
    <PlayoffList :playoff-teams="playoffsMadison" league="Madison" />
    <PlayoffList :playoff-teams="playoffsLA" league="LA" />
  </div>
</template>
