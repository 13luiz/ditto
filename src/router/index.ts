import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/chat' },
  {
    path: '/chat',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/ChatView.vue') },
    ],
  },
  {
    path: '/care',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/CareView.vue') },
    ],
  },
  {
    path: '/settings',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/SettingsView.vue') },
    ],
  },
  {
    path: '/skins',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/SkinsView.vue') },
    ],
  },
  {
    path: '/play',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/PlayHistoryView.vue') },
    ],
  },
  {
    path: '/letters',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/LettersView.vue') },
    ],
  },
  {
    path: '/journal',
    component: () => import('../views/PetManagerView.vue'),
    children: [
      { path: '', component: () => import('../views/JournalView.vue') },
    ],
  },
  { path: '/rooms', component: () => import('../views/RoomListView.vue') },
  { path: '/room/:id', component: () => import('../views/RoomView.vue') },
  { path: '/agents', component: () => import('../views/AgentListView.vue') },
  { path: '/agent/:id', component: () => import('../views/AgentDetailView.vue') },
  { path: '/onboarding', component: () => import('../views/OnboardingView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
