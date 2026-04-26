import { invoke } from '@tauri-apps/api/core'
import { onMounted, ref } from 'vue'
import { playSound } from '../sound'
import type { CareState } from '../types/care'

const MOOD_EMOJI: Record<string, string> = {
  ecstatic: '\u{1F929}',
  happy: '\u{1F60A}',
  neutral: '\u{1F610}',
  sad: '\u{1F622}',
  miserable: '\u{1F629}',
}

export function useCare() {
  const state = ref<CareState>({
    needs: { hunger: 0, happiness: 0, energy: 0, social: 0 },
    mood_score: 0,
    mood_label: 'neutral',
  })

  function moodEmoji(label: string): string {
    return MOOD_EMOJI[label] ?? '\u{1F610}'
  }

  async function load() {
    try {
      state.value = await invoke<CareState>('get_care_state')
    } catch (e) {
      console.error('[ditto] load care state error:', e)
    }
  }

  async function applyAction(action: 'feed' | 'pet' | 'chat' | 'sleep') {
    try {
      playSound(action)
      state.value = await invoke<CareState>('apply_care_action', { action })
      if (state.value.mood_label === 'ecstatic' || state.value.mood_label === 'happy') {
        playSound('happy')
      }
    } catch (e) {
      console.error('[ditto] care action error:', e)
    }
  }

  return { state, moodEmoji, load, applyAction }
}
