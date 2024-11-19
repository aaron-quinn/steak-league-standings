<script setup>
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import domToImage from 'dom-to-image';
import { ref, onMounted } from 'vue';
import { saveAs } from 'file-saver';

const root = ref(null);

function triggerScreenshot() {
  const classesForImage = ['bg-slate-900', 'p-4'];
  classesForImage.forEach((className) => {
    root.value.classList.add(className);
  });

  const node = root.value;
  domToImage
    .toBlob(node)
    .then(function (blob) {
      console.log(blob);
      saveAs(blob, 'steak-league-standings.png');
      classesForImage.forEach((className) => {
        root.value.classList.remove(className);
      });
    })
    .catch((err) => {
      console.log(err);
    });
}

function triggerPizzaAnimation() {
  const pizzaContainer = document.createElement('div');
  pizzaContainer.classList.add('pizza-animation-container');
  document.body.appendChild(pizzaContainer);

  for (let i = 0; i < 50; i++) {
    const pizza = document.createElement('div');
    pizza.classList.add('pizza');
    pizza.style.left = `${Math.random() * 100}vw`;
    pizza.style.animationDelay = `${Math.random() * 2}s`;
    pizzaContainer.appendChild(pizza);
  }
}

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
  .sort((a, b) => {
    if (a.points === b.points) {
      return a.name.localeCompare(b.name);
    }
    return b.points - a.points;
  });

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
  <ul class="w-full antialiased" ref="root">
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
        <div
          class="ml-2"
          :class="{
            'cursor-pointer': team.name.includes('Kurt'),
          }"
          @click="team.name.includes('Kurt') && triggerPizzaAnimation()"
        >
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
  <div class="flex justify-end mt-3 mb-5">
    <button
      class="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-1 rounded-md text-sm font-semibold inline-flex items-center"
      @click="triggerScreenshot"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-5 h-5 mr-2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
        />
      </svg>

      Screenshot
    </button>
  </div>
</template>

<style>
.pizza-animation-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  overflow: hidden;
  z-index: 9999;
}

.pizza {
  position: absolute;
  top: -100px;
  width: 100px;
  height: 100px;
  background-image: url('tombstone-pizza.webp'); /* Replace with the path to your pizza image */
  background-size: cover;
  animation: fall 3s linear infinite;
}

@keyframes fall {
  to {
    transform: translateY(100vh);
  }
}
</style>
