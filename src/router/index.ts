import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/rooms' },
  { path: '/rooms', component: () => import('../views/RoomListView.vue') },
  { path: '/room/:id', component: () => import('../views/RoomView.vue') },
  { path: '/agents', component: () => import('../views/AgentListView.vue') },
  { path: '/agent/:id', component: () => import('../views/AgentDetailView.vue') },
  { path: '/settings', component: () => import('../views/SettingsView.vue') },
  { path: '/onboarding', component: () => import('../views/OnboardingView.vue') },
  { path: '/chat', component: () => import('../views/ChatView.vue') },
  { path: '/care', component: () => import('../views/CareView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
