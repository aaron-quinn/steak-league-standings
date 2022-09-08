<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <Suspense>
    <template #default>
      <RouterView />
    </template>
    <template #fallback>
      <h1>Loading standings...</h1>
    </template>
  </Suspense>
</template>
