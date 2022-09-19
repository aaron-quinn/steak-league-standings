<script setup>
import { useStandingsStore } from '../stores/standings';

const { live } = useStandingsStore();
const tabs = [
  { name: 'Official Standings', href: '/', current: !live },
  { name: 'Live Standings', href: '/live', current: live },
];
</script>

<template>
  <div class="mb-6 antialiased">
    <div class="sm:hidden">
      <label for="tabs" class="sr-only">Select a tab</label>
      <!-- Use an "onChange" listener to redirect the user to the selected tab URL. -->
      <select
        id="tabs"
        name="tabs"
        class="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
      >
        <option v-for="tab in tabs" :key="tab.name" :selected="tab.current">
          {{ tab.name }}
        </option>
      </select>
    </div>
    <div class="hidden sm:block">
      <nav class="flex space-x-4" aria-label="Tabs">
        <a
          v-for="tab in tabs"
          :key="tab.name"
          :href="tab.href"
          :class="[
            tab.current
              ? 'bg-slate-200 text-slate-800'
              : 'text-slate-200 hover:text-slate-50',
            'px-3 py-2 font-medium text-base rounded-md',
          ]"
          :aria-current="tab.current ? 'page' : undefined"
          >{{ tab.name }}</a
        >
      </nav>
    </div>
  </div>
</template>
