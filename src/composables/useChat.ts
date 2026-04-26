import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { nextTick, onUnmounted, ref } from 'vue'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const inputText = ref('')
  const isTyping = ref(false)
  let unlistenToken: UnlistenFn | null = null
  let unlistenDone: UnlistenFn | null = null

  async function init() {
    // Load history
    try {
      const history = await invoke<{ role: string; content: string }[]>('load_chat_history')
      messages.value = history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[ditto] load_chat_history failed:', e);
    }

    // Listen for streaming tokens
    unlistenToken = await listen<{ token: string }>('chat-stream-token', (event) => {
      isTyping.value = false
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'assistant') {
        last.content += event.payload.token
      } else {
        messages.value.push({ role: 'assistant', content: event.payload.token })
      }
    })

    unlistenDone = await listen<{ full_response: string }>('chat-stream-done', () => {
      isTyping.value = false
    })
  }

  async function send() {
    const text = inputText.value.trim()
    if (!text) return
    inputText.value = ''
    messages.value.push({ role: 'user', content: text })
    isTyping.value = true
    try {
      await invoke('send_chat_message', { message: text })
    } catch (e) {
      isTyping.value = false
      messages.value.push({ role: 'assistant', content: `Error: ${e}` })
    }
  }

  onUnmounted(() => {
    unlistenToken?.()
    unlistenDone?.()
  })

  return { messages, inputText, isTyping, init, send }
}
