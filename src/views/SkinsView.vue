<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

interface SkinEntry {
  id: string
  name: string
  renderer: string
  source: string
  path: string
}

const skins = ref<SkinEntry[]>([])
const filter = ref<'all' | 'sprite' | 'spine'>('all')
const activeSkin = ref('default')

const filteredSkins = computed(() => {
  if (filter.value === 'all') return skins.value
  return skins.value.filter((s) => s.renderer === filter.value)
})

onMounted(async () => {
  try {
    const [catalog, active] = await Promise.all([
      invoke<SkinEntry[]>('list_skins_catalog'),
      invoke<string>('get_active_skin'),
    ])
    skins.value = catalog
    activeSkin.value = active
  } catch (e) {
    console.error('[ditto] failed to load skins:', e)
  }
})

async function selectSkin(id: string) {
  try {
    await invoke('set_active_skin', { skinId: id })
    activeSkin.value = id
  } catch (e) {
    console.error('[ditto] failed to set skin:', e)
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 p-3 select-none bg-[rgba(30,30,40,0.95)]">
    <div class="text-3.5 font-bold">Skins</div>

    <div class="flex gap-1">
      <button
        v-for="f in (['all', 'sprite', 'spine'] as const)"
        :key="f"
        class="cursor-pointer rounded-md border-none px-2.5 py-1 text-2.5 capitalize"
        :class="filter === f ? 'bg-blue-500/80 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'"
        @click="filter = f"
      >
        {{ f }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="skin in filteredSkins"
          :key="skin.id"
          class="cursor-pointer rounded-lg border p-2 transition-colors"
          :class="activeSkin === skin.id
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/20'"
          @click="selectSkin(skin.id)"
        >
          <div class="mb-1.5 flex h-16 items-center justify-center rounded bg-black/30 text-3 text-gray-500">
            {{ skin.renderer === 'spine' ? '🦴' : '🖼️' }} {{ skin.name }}
          </div>
          <div class="flex items-center justify-between">
            <span class="text-2.5 text-gray-300">{{ skin.name }}</span>
            <span
              class="rounded px-1 py-0.5 text-1.5 uppercase"
              :class="skin.renderer === 'spine' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'"
            >
              {{ skin.renderer }}
            </span>
          </div>
          <div class="mt-0.5 flex items-center justify-between">
            <span class="text-1.5 text-gray-500">{{ skin.source }}</span>
            <span
              class="flex items-center gap-0.5 rounded px-1 py-0.5 text-1.5 bg-emerald-500/15 text-emerald-400"
              title="Unlocked"
            >
              &#x2713; free
            </span>
          </div>
        </div>
      </div>

      <div v-if="filteredSkins.length === 0" class="py-8 text-center text-3 text-gray-500">
        No skins found
      </div>
    </div>
  </div>
</template>
