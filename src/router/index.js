import { createRouter, createWebHistory } from 'vue-router';
import StandingsView from '../views/StandingsView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'standings',
      component: StandingsView,
    },
  ],
});

export default router;
