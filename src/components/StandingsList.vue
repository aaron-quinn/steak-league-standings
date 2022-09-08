<script setup>
const props = defineProps({
  steakTeams: Array,
});

console.log(props.steakTeams);
</script>

<template>
  <ul class="px-10 w-full">
    <li
      v-for="(team, index) in steakTeams"
      :key="team.id"
      class="px-4 py-4 mb-3 w-full rounded-md bg-slate-800 text-slate-200 font-light text-xl flex justify-between shadow-2xl"
    >
      <div>
        {{ index + 1 }}
        <span class="ml-2 font-bold text-2xl">{{ team.name }}</span>
      </div>
      <div class="text-2xl font-bold">{{ team.points }}</div>
    </li>
  </ul>
</template>
