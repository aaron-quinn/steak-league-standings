<script setup>
const props = defineProps({
  steakTeams: Array,
});

console.log(props.steakTeams);
</script>

<template>
  <ul class="px-10 w-full">
    <li
      class="p-2 mb-4 w-full rounded-sm bg-slate-400"
      v-for="(team, index) in steakTeams"
      :key="team.id"
    >
      <span class="team-name">{{ index + 1 }} {{ team.name }}</span>
      <span class="team-points">{{ team.points }}</span>
    </li>
  </ul>
</template>
