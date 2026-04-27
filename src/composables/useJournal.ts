import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface JournalEntry {
  id: number
  entry_date: string
  content: string
  mood_summary: string | null
  stats_json: string | null
  milestone: string | null
  created_at: string
}

export function useJournal() {
  const entries = ref<JournalEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEntries(startDate: string, endDate: string) {
    loading.value = true
    error.value = null
    try {
      const res = await invoke<{ entries: JournalEntry[] }>('get_journal_entries', {
        startDate,
        endDate,
      })
      entries.value = res.entries
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function generateEntry(entryDate?: string) {
    loading.value = true
    error.value = null
    try {
      const date = entryDate ?? new Date().toISOString().slice(0, 10)
      const res = await invoke<{ id: number; content: string }>('generate_journal_entry', {
        entryDate: date,
        content: '',
      })
      return res
    } catch (e) {
      error.value = String(e)
      return null
    } finally {
      loading.value = false
    }
  }

  return { entries, loading, error, fetchEntries, generateEntry }
}
