<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useChatLog } from '../composables/useChatLog'

const { chatEntries, memories, identity, loading, error, fetchChat, fetchMemories, fetchIdentity } = useChatLog()
const activeTab = ref<string>('chat')

const deferredTabs = [
  { id: 'rooms', label: 'Rooms', hint: 'Multi-agent group chat (Phase 10)' },
  { id: 'runtime', label: 'Runtime', hint: 'Heartbeat & behavior rules (Phase 9+)' },
  { id: 'plugins', label: 'Plugins', hint: 'Extensions & skills (Phase 9+)' },
]

const isDeferred = computed(() => deferredTabs.some(t => t.id === activeTab.value))
const deferredHint = computed(() => deferredTabs.find(t => t.id === activeTab.value)?.hint ?? '')

onMounted(async () => {
  await fetchChat()
})

async function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'chat') await fetchChat()
  else if (tab === 'memory') await fetchMemories()
  else if (tab === 'identity') await fetchIdentity()
}

function traitBar(label: string, value: number) {
  return { label, value, pct: Math.min(100, Math.max(0, value)) }
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-auto p-4 text-sm text-white">
    <h2 class="text-lg font-bold">Chat Log</h2>

    <div v-if="error" class="text-red-400 text-xs">{{ error }}</div>

    <!-- Tab bar: 3 active + 3 deferred -->
    <div class="flex flex-wrap gap-1">
      <button
        v-for="tab in ['chat', 'memory', 'identity', 'rooms', 'runtime', 'plugins']"
        :key="tab"
        class="cursor-pointer rounded-md border-none px-3 py-1 text-xs capitalize"
        :class="activeTab === tab
          ? 'bg-blue-600 text-white'
          : tab === 'chat' || tab === 'memory' || tab === 'identity'
            ? 'bg-white/5 text-gray-400 hover:text-white'
            : 'bg-white/[0.02] text-gray-600 hover:text-gray-400'"
        @click="switchTab(tab)"
      >
        {{ tab }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 text-xs">Loading...</div>

    <!-- Chat tab -->
    <div v-else-if="activeTab === 'chat'" class="flex flex-col gap-2">
      <div v-if="chatEntries.length === 0" class="text-gray-500 text-xs">No chat messages yet.</div>
      <div
        v-for="(entry, i) in chatEntries"
        :key="i"
        class="rounded-lg px-3 py-2 text-xs"
        :class="entry.role === 'user' ? 'bg-blue-900/30 ml-6' : 'bg-white/5 mr-6'"
      >
        <div class="mb-1 text-[10px] font-bold" :class="entry.role === 'user' ? 'text-blue-300' : 'text-green-300'">
          {{ entry.role === 'user' ? 'You' : identity?.pet_name ?? 'Pet' }}
        </div>
        <div class="text-gray-300 whitespace-pre-wrap">{{ entry.content }}</div>
      </div>
    </div>

    <!-- Memory tab -->
    <div v-else-if="activeTab === 'memory'" class="flex flex-col gap-2">
      <div v-if="memories.length === 0" class="text-gray-500 text-xs">No memories stored yet.</div>
      <div
        v-for="(mem, i) in memories"
        :key="i"
        class="rounded-lg bg-white/5 px-3 py-2 text-xs"
      >
        <div class="mb-1 text-[10px] font-bold text-amber-300">{{ mem.key }}</div>
        <div class="text-gray-300 whitespace-pre-wrap">{{ mem.value }}</div>
      </div>
    </div>

    <!-- Identity tab -->
    <div v-else-if="activeTab === 'identity'" class="flex flex-col gap-3">
      <div v-if="!identity" class="text-gray-500 text-xs">No identity data.</div>
      <template v-else>
        <div class="text-base font-medium">{{ identity.pet_name }}</div>
        <div
          v-for="t in [
            traitBar('Cheerfulness', identity.traits.cheerfulness),
            traitBar('Curiosity', identity.traits.curiosity),
            traitBar('Mischievousness', identity.traits.mischievousness),
            traitBar('Clinginess', identity.traits.clinginess),
          ]"
          :key="t.label"
          class="flex flex-col gap-1"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-400">{{ t.label }}</span>
            <span class="text-gray-500">{{ t.value }}</span>
          </div>
          <div class="h-1.5 w-full rounded-full bg-white/10">
            <div class="h-1.5 rounded-full bg-blue-400" :style="{ width: t.pct + '%' }" />
          </div>
        </div>
      </template>
    </div>

    <!-- Deferred tabs -->
    <div v-else-if="isDeferred" class="flex flex-1 items-center justify-center">
      <div class="text-center text-gray-600">
        <div class="mb-2 text-2xl">🚧</div>
        <div class="text-xs">{{ deferredHint }}</div>
      </div>
    </div>
  </div>
</template>
