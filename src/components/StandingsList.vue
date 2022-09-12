<script setup>
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';

const { standings, year, live } = useStandingsStore();

const steakTeams = getManagers()
  .filter((t) => t.teams[year] && 'steak' in t.teams[year])
  .map((t) => {
    const { league, teamID, division, teams } = t.teams[year];
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
      teams: t.teams,
    };
  })
  .sort((a, b) => b.points - a.points);

const teams = [...steakTeams];

// Calculate the number of teams that get a steak
const numTeamsGettingASteak = Math.floor(teams.length / 2);

// Is there a self-buyer spot
const selfBuyerSpot = teams.length % 2 !== 0;

const steakLineTeam = selfBuyerSpot
  ? numTeamsGettingASteak
  : numTeamsGettingASteak - 1;

// Calculate the points scored by the team at the steak line
const steakLinePts = teams[steakLineTeam].points;

// Add the distance from the steak line
const teamsWithGap = teams.map((t) => {
  const gap = Math.round((t.points - steakLinePts) * 10) / 10;
  const gapOperator = gap > 0 ? '+' : '';
  const pointsPieces = t.points.toString().split('.');
  const gapPieces = gap.toFixed(2).toString().split('.');
  return {
    ...t,
    gap: Number(gap) === 0 ? 0 : gap.toFixed(2),
    gapOperator,
    pointsInt: pointsPieces[0],
    pointsDec: pointsPieces[1],
    gapInt: gapPieces[0],
    gapDec: gapPieces[1],
  };
});
</script>

<template>
  <ul class="w-full antialiased">
    <li
      v-for="(team, index) in teamsWithGap"
      :key="team.id"
      class="px-4 py-1 lg:py-2 w-full bg-slate-800 text-slate-300 font-light text-base lg:text-xl flex justify-between shadow-2xl items-center"
      :class="{
        'rounded-t-md': index === 0 || index === steakLineTeam + 1,
        'rounded-b-md': index === teamsWithGap.length - 1,
        'mb-0': index !== steakLineTeam,
        'mt-4 mb-4 lg:mt-6 lg:mb-6 rounded-md':
          index === steakLineTeam && selfBuyerSpot,
        'mb-4 lg:mb-6 rounded-b-md': index === steakLineTeam && !selfBuyerSpot,
      }"
    >
      <div class="flex items-center">
        <div class="w-5">
          {{ index + 1 }}
        </div>
        <div class="ml-2">
          {{ team.name }}
          <span class="text-slate-400 ml-1 text-xs lg:text-sm" v-if="!live">{{
            team.record
          }}</span>
        </div>
      </div>
      <div class="flex items-center font-numerals tracking-tight">
        <div class="text-base lg:text-lg">
          <span>
            {{ Number(team.pointsInt).toLocaleString('en-US')
            }}<span
              class="text-slate-400 text-[11px] lg:text-xs relative left-[1px]"
              >.{{ team.pointsDec }}</span
            >
          </span>
        </div>
        <div
          class="w-12 lg:w-14 text-right ml-3 text-sm lg:text-base font-bold"
          :class="{
            'text-green-500': Number(team.gap) > 0,
            'text-gray-500': Number(team.gap) === 0,
            'text-red-500': Number(team.gap) < 0,
          }"
        >
          <span v-if="team.gap === 0">&ndash;</span>
          <span v-if="team.gap !== 0">{{
            team.gapOperator + team.gapInt
          }}</span>
          <span
            v-if="team.gap !== 0"
            class="text-[11px] lg:text-xs left-[1px] relative font-normal"
            >.{{ team.gapDec }}</span
          >
        </div>
      </div>
    </li>
  </ul>
</template>
