<script setup lang="ts">
import { onMounted } from 'vue'
import { useCare } from '../composables/useCare'
import { useWindow } from '../composables/useWindow'

const { state, moodEmoji, load, applyAction } = useCare()
const { close } = useWindow()

onMounted(load)

const BARS = [
  { key: 'hunger' as const, label: 'hunger', color: '#e74c3c' },
  { key: 'happiness' as const, label: 'happiness', color: '#f1c40f' },
  { key: 'energy' as const, label: 'energy', color: '#2ecc71' },
  { key: 'social' as const, label: 'social', color: '#3498db' },
] as const
</script>

<template>
  <div class="flex h-full flex-col p-3 gap-3 select-none bg-[rgba(30,30,40,0.95)]">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <span class="text-3.5 font-bold">Care</span>
      <button class="cursor-pointer border-none bg-transparent px-1 text-4 text-white/40 hover:text-white/80" @click="close">×</button>
    </div>

    <!-- Mood -->
    <div class="text-center text-3">
      {{ moodEmoji(state.mood_label) }} {{ state.mood_label }} ({{ Math.round(state.mood_score) }}%)
    </div>

    <!-- Bars -->
    <div class="flex flex-col gap-2">
      <div v-for="bar in BARS" :key="bar.key" class="flex items-center gap-2">
        <span class="w-16 text-2.5 text-gray-400">{{ bar.label }}</span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full transition-all duration-300"
            :style="{ width: `${state.needs[bar.key]}%`, background: bar.color }"
          />
        </div>
        <span class="w-6 text-right text-2.5 text-gray-400">{{ Math.round(state.needs[bar.key]) }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="grid grid-cols-2 gap-2 mt-1">
      <button
        v-for="action in (['feed', 'pet', 'chat', 'sleep'] as const)"
        :key="action"
        class="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-3 capitalize text-gray-300 hover:bg-white/10"
        @click="applyAction(action)"
      >
        {{ action }}
      </button>
    </div>
  </div>
</template>
