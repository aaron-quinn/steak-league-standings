<script setup>
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';

const store = useStandingsStore();
const { year } = useStandingsStore();

const managers = getManagers();

const steakManagers = managers
  .filter((t) => t.teams[year] && 'steak' in t.teams[year])
  .map((t) => {
    const { league, teamID, division, teams } = t.teams[year];
    const id = `${league.toLowerCase()}${teamID}`;
    return {
      id,
      name: t.name,
      league,
      division,
      teamID,
      teams: t.teams,
    };
  })
  .sort((a, b) => b.points - a.points);

const managersList = steakManagers
  .map((m) => {
    const teams = Object.values(m.teams);
    teams.pop();
    const numSteaks = teams.reduce((acc, t) => acc + (t.steak ? 1 : 0), 0);
    return {
      name: m.name,
      numSteaks,
      steaks: teams.map((t) => t.steak),
      missedSteaks: teams.filter((t) => 'steak' in t && !t.steak),
      steaksWidth: `${20 * numSteaks}px`,
    };
  })
  .filter((m) => m.steaks.length);

managersList.sort((a, b) => {
  if (a.numSteaks === b.numSteaks) {
    return a.missedSteaks.length - b.missedSteaks.length;
  }
  return b.numSteaks - a.numSteaks;
});
</script>

<template>
  <div class="hidden lg:block">
    <div class="bg-slate-700 text-slate-300 py-2 px-4 rounded-t-md font-bold">
      Madison Steak Leaderboard
      <span class="text-sm pl-1 font-thin">Since 2016</span>
    </div>
    <ul class="w-full antialiased text-lg bg-slate-800 py-3 rounded-b-md mb-8">
      <li
        v-for="manager in managersList"
        :key="manager.name"
        class="px-4 w-full text-slate-300 font-light flex justify-between shadow-2xl items-center"
      >
        <div class="flex items-center leading-6 text-sm gap-x-3">
          <div class="flex items-center justify-start w-[140px] tracking-wider">
            <div v-for="n in manager.numSteaks" :key="n">🥩</div>
            <div v-for="n in manager.missedSteaks" :key="n" class="opacity-10">
              🥩
            </div>
          </div>
          <div>
            {{ manager.name.split(' ')[1] }}
            <span class="text-slate-400 text-xs font-thin ml-0.5">
              {{
                Math.round(
                  (100 * manager.numSteaks) /
                    (manager.numSteaks + manager.missedSteaks.length)
                ).toFixed(0)
              }}%
            </span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
