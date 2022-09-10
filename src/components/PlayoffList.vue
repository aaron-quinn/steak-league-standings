<script setup>
import { ref } from 'vue';
import PlayoffList from './PlayoffList.vue';

const props = defineProps({
  playoffTeams: Object,
  league: String,
});

const leagueName = ref(props.league);
</script>

<template>
  <div class="bg-slate-800 rounded-md mb-6 flex-grow antialiased">
    <div
      class="py-3 px-4 bg-slate-700 text-slate-300 rounded-t-md text-lg font-bold"
    >
      {{ leagueName }} Playoffs
    </div>
    <div class="py-2">
      <div
        class="py-2 px-4"
        v-for="[qualifier, name] in playoffTeams"
        :key="name"
      >
        <div class="text-slate-300 text-lg font-normal">
          {{ name }}
        </div>
        <div class="text-slate-400 text-sm">{{ qualifier }}</div>
      </div>
    </div>
  </div>
</template>
