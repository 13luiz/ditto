import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface MiniGameResult {
  game_type: string
  score: number
  won: boolean
  care_effects: Record<string, number>
}

export function useMiniGame() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function startGame(gameType: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await invoke('start_mini_game', { gameType })
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function submitResult(
    gameType: string,
    score: number,
    won: boolean,
  ): Promise<MiniGameResult> {
    loading.value = true
    error.value = null
    try {
      return await invoke<MiniGameResult>('submit_mini_game_result', {
        gameType,
        score,
        won,
      })
    } catch (e) {
      error.value = String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, startGame, submitResult }
}
