import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface GameHistoryEntry {
  id: number
  game_type: string
  score: number
  won: boolean
  played_at: string
}

export function useGameHistory() {
  const games = ref<GameHistoryEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchHistory(gameType?: string, limit = 50): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await invoke<{ games: GameHistoryEntry[] }>('get_game_history', {
        gameType: gameType ?? null,
        limit,
      })
      games.value = res.games
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  return { games, loading, error, fetchHistory }
}
