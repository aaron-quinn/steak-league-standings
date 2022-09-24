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
    <div class="block">
      <nav
        class="flex space-x-4 justify-center lg:justify-start"
        aria-label="Tabs"
      >
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
