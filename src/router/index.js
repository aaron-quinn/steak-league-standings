import { createRouter, createWebHistory } from 'vue-router';
import MainView from '../views/MainView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'standings',
      component: MainView,
      props: {
        live: false,
      },
    },
    {
      path: '/live',
      name: 'live-standings',
      component: MainView,
      props: {
        live: true,
      },
    },
  ],
});

export default router;
