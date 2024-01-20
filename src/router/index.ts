import { createRouter, createWebHashHistory } from 'vue-router'
import StartView from '@/views/StartView.vue'

const routes = [
  {
    path: '/',
    name: 'start',
    component: StartView
  },
  {
    path: '/home',
    name: 'home',
    component: () => import(/* webpackChunkName: "home" */ '../views/HomeView.vue')
  },
  {
    path: '/item/:id?',
    name: 'item',
    component: () => import(/* webpackChunkName: "item" */ '../views/ItemView.vue'),
    props: (route) => {
      return {
          id: route.params.id
      };
  }
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "settings" */ '../views/SettingsView.vue')
  },
  {
    path: '/tip-me',
    name: 'tip-me',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "tip-me" */ '../views/TipMeView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
