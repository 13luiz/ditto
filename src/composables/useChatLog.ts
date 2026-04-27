import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'

export interface ChatLogEntry {
  role: string
  content: string
  timestamp?: string
}

export function useChatLog() {
  const entries = ref<ChatLogEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchHistory(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const history = await invoke<{ role: string; content: string }[]>('load_chat_history')
      entries.value = history.map(m => ({
        role: m.role,
        content: m.content,
      }))
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  return { entries, loading, error, fetchHistory }
}
