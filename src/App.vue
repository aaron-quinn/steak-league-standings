<script setup>
import { RouterView } from 'vue-router';
import LoadingScreen from './components/LoadingScreen.vue';
</script>

<template>
  <RouterView v-slot="{ Component }">
    <template v-if="Component">
      <Transition mode="out-in">
        <KeepAlive>
          <Suspense>
            <component :is="Component"></component>
            <template #fallback>
              <LoadingScreen />
            </template>
          </Suspense>
        </KeepAlive>
      </Transition>
    </template>
  </RouterView>
</template>
