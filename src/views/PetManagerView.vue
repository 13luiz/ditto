<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindow } from '../composables/useWindow'

const route = useRoute()
const router = useRouter()
const { close } = useWindow()

const tabs = [
  { path: '/chat', label: 'Chat' },
  { path: '/care', label: 'Care' },
  { path: '/play', label: 'Play' },
  { path: '/letters', label: 'Letters' },
  { path: '/journal', label: 'Journal' },
  { path: '/skins', label: 'Skins' },
  { path: '/settings', label: 'Settings' },
] as const

const activeTab = computed(() => {
  const current = tabs.find((t) => route.path === t.path || route.path.startsWith(t.path + '/'))
  return current?.path ?? '/chat'
})

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="flex h-full flex-col bg-[rgba(30,30,40,0.95)]">
    <div class="flex items-center border-b border-white/5">
      <button
        v-for="tab in tabs"
        :key="tab.path"
        class="flex-1 cursor-pointer border-none bg-transparent px-2 py-2 text-3 text-gray-400 hover:text-white"
        :class="activeTab === tab.path ? 'border-b-2 !border-blue-400 !text-white' : ''"
        @click="navigate(tab.path)"
      >
        {{ tab.label }}
      </button>
      <button
        class="cursor-pointer border-none bg-transparent px-2 text-3.5 text-white/40 hover:text-white/80"
        @click="close"
      >
        &times;
      </button>
    </div>
    <div class="flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
