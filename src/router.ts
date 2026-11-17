import { createRouter, createWebHashHistory } from 'vue-router'
import ConfigView from './views/ConfigView.vue'
import DrillView from './views/DrillView.vue'
import LeaksView from './views/LeaksView.vue'

// Roteador em modo hash (spec 5): o site é estático, então o endereço não depende de reescrita no
// servidor. O store do drill é global, então a sessão sobrevive à troca de tela.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'drill', component: DrillView },
    { path: '/leaks', name: 'leaks', component: LeaksView },
    { path: '/config', name: 'config', component: ConfigView },
    { path: '/:resto(.*)*', redirect: '/' },
  ],
})
