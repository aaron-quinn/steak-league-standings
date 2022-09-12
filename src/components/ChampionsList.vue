<script setup>
import getManagers from '../data/managers.js';

// Find champion managers for each year
const champions = getManagers().filter((m) => {
  return Object.values(m.teams).some((t) => t.champion);
});

champions.map((c) => {
  Object.keys(c.teams).map((y) => {
    if (c.teams[y].champion) {
      (c.year = c.year || []).push(y);
    }
  });
  delete c.teams;
  return c;
});

const championsList = [];
champions.forEach((c) => {
  c.year.forEach((y) => {
    championsList.push({ name: c.name, year: y });
  });
});

championsList.sort((a, b) => b.year - a.year);
</script>

<template>
  <div class="hidden lg:block">
    <div class="bg-slate-700 text-slate-300 py-2 px-4 rounded-t-md font-bold">
      Champions
    </div>
    <ul
      class="w-full antialiased text-base bg-slate-800 py-3 rounded-b-md mb-6"
    >
      <li
        v-for="manager in championsList"
        :key="manager.name"
        class="px-4 w-full text-slate-300 font-light flex justify-between shadow-2xl items-center"
      >
        <div class="flex items-center leading-7">
          <div class="w-7 mr-3">{{ manager.year }}</div>
          <div class="ml-2">
            {{ manager.name }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
