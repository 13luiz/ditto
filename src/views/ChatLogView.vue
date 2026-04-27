<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useChatLog } from '../composables/useChatLog'

const { entries, loading, error, fetchHistory } = useChatLog()
const tab = ref<'all' | 'user' | 'assistant'>('all')

const filtered = computed(() => {
  if (tab.value === 'all') return entries.value
  return entries.value.filter(e => e.role === tab.value)
})

onMounted(() => {
  fetchHistory()
})
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-auto p-4 text-sm text-white">
    <h2 class="text-lg font-bold">Chat Log</h2>

    <div v-if="error" class="text-red-400 text-xs">{{ error }}</div>

    <div class="flex gap-2">
      <button
        v-for="t in (['all', 'user', 'assistant'] as const)"
        :key="t"
        class="cursor-pointer rounded-md border-none px-3 py-1 text-xs"
        :class="tab === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'"
        @click="tab = t"
      >
        {{ t === 'all' ? 'All' : t === 'user' ? 'You' : 'Pet' }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 text-xs">Loading...</div>

    <div v-else-if="filtered.length === 0" class="text-gray-500 text-xs">
      No chat messages yet.
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(entry, i) in filtered"
        :key="i"
        class="rounded-lg px-3 py-2 text-xs"
        :class="entry.role === 'user'
          ? 'bg-blue-900/30 ml-6'
          : 'bg-white/5 mr-6'"
      >
        <div class="mb-1 text-[10px] font-bold" :class="entry.role === 'user' ? 'text-blue-300' : 'text-green-300'">
          {{ entry.role === 'user' ? 'You' : 'Pet' }}
        </div>
        <div class="text-gray-300 whitespace-pre-wrap">{{ entry.content }}</div>
      </div>
    </div>
  </div>
</template>
