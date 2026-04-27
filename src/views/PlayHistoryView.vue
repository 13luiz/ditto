<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useGameHistory } from '../composables/useGameHistory'

const { games, loading, error, fetchHistory } = useGameHistory()
const filter = ref<string>('all')

const filteredGames = computed(() => {
  if (filter.value === 'all') return games.value
  return games.value.filter(g => g.game_type === filter.value)
})

const stats = computed(() => {
  const total = games.value.length
  const wins = games.value.filter(g => g.won).length
  const rpsGames = games.value.filter(g => g.game_type === 'rps')
  const catchGames = games.value.filter(g => g.game_type === 'catch')
  return { total, wins, losses: total - wins, rps: rpsGames.length, catch: catchGames.length }
})

onMounted(() => {
  fetchHistory()
})

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-auto p-4 text-sm text-white">
    <h2 class="text-lg font-bold">Game History</h2>

    <div v-if="error" class="text-red-400 text-xs">{{ error }}</div>

    <div class="flex gap-4 text-xs text-gray-400">
      <span>Total: {{ stats.total }}</span>
      <span class="text-green-400">Wins: {{ stats.wins }}</span>
      <span class="text-red-400">Losses: {{ stats.losses }}</span>
    </div>

    <div class="flex gap-2">
      <button
        v-for="f in ['all', 'rps', 'catch']"
        :key="f"
        class="cursor-pointer rounded-md border-none px-3 py-1 text-xs"
        :class="filter === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'"
        @click="filter = f"
      >
        {{ f === 'all' ? 'All' : f === 'rps' ? 'RPS' : 'Catch' }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 text-xs">Loading...</div>

    <div v-else-if="filteredGames.length === 0" class="text-gray-500 text-xs">
      No games played yet. Play with your pet to see history here!
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="game in filteredGames"
        :key="game.id"
        class="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
      >
        <span class="text-lg">{{ game.game_type === 'rps' ? '🪨' : '🍎' }}</span>
        <div class="flex-1">
          <div class="text-xs font-medium">
            {{ game.game_type === 'rps' ? 'Rock Paper Scissors' : 'Catch the Food' }}
          </div>
          <div class="text-[10px] text-gray-500">{{ formatDate(game.played_at) }}</div>
        </div>
        <div class="text-right">
          <div class="text-xs font-bold" :class="game.won ? 'text-green-400' : 'text-red-400'">
            {{ game.won ? 'WIN' : 'LOSS' }}
          </div>
          <div class="text-[10px] text-gray-500">Score: {{ game.score }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
