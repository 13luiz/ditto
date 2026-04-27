import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'

export interface ChatEntry {
  role: string
  content: string
}

export interface MemoryEntry {
  key: string
  value: string
}

export interface IdentityData {
  traits: {
    cheerfulness: number
    curiosity: number
    mischievousness: number
    clinginess: number
  }
  pet_name: string
}

export function useChatLog() {
  const chatEntries = ref<ChatEntry[]>([])
  const memories = ref<MemoryEntry[]>([])
  const identity = ref<IdentityData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchChat(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const history = await invoke<{ role: string; content: string }[]>('load_chat_history')
      chatEntries.value = history
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function fetchMemories(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await invoke<{ memories: MemoryEntry[] }>('list_memories')
      memories.value = res.memories
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function fetchIdentity(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await invoke<IdentityData>('get_personality')
      identity.value = res
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  return { chatEntries, memories, identity, loading, error, fetchChat, fetchMemories, fetchIdentity }
}
