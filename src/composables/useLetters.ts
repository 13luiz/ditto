import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface Letter {
  id: number
  direction: string
  content: string
  attachment: string | null
  read_at: string | null
  created_at: string
}

export function useLetters() {
  const pending = ref<Letter[]>([])
  const archive = ref<Letter[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPending() {
    loading.value = true
    error.value = null
    try {
      const res = await invoke<{ letters: Letter[] }>('get_pending_letters')
      pending.value = res.letters
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function fetchArchive(limit = 20, offset = 0) {
    loading.value = true
    error.value = null
    try {
      const res = await invoke<{ letters: Letter[] }>('get_letter_archive', { limit, offset })
      archive.value = res.letters
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function markRead(letterId: number) {
    try {
      await invoke('mark_letter_read', { letterId })
      pending.value = pending.value.filter((l) => l.id !== letterId)
    } catch (e) {
      error.value = String(e)
    }
  }

  async function sendReply(letterId: number, content: string) {
    try {
      await invoke('send_letter_reply', { letterId, content })
      await markRead(letterId)
    } catch (e) {
      error.value = String(e)
    }
  }

  return { pending, archive, loading, error, fetchPending, fetchArchive, markRead, sendReply }
}
