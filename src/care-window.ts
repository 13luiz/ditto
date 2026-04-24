import { invoke } from '@tauri-apps/api/core';
import { playSound } from './ui/sound';

interface CareState {
  hunger: number;
  happiness: number;
  energy: number;
  social: number;
  mood_score: number;
  mood_label: string;
}

function moodEmoji(label: string): string {
  switch (label) {
    case 'ecstatic': return '\u{1F929}';
    case 'happy': return '\u{1F60A}';
    case 'neutral': return '\u{1F610}';
    case 'sad': return '\u{1F622}';
    case 'miserable': return '\u{1F629}';
    default: return '\u{1F610}';
  }
}

function createBar(label: string, value: number, color: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'bar-row';

  const lbl = document.createElement('span');
  lbl.className = 'bar-label';
  lbl.textContent = label;

  const track = document.createElement('div');
  track.className = 'bar-track';

  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  fill.style.width = `${value}%`;
  fill.style.background = color;

  const val = document.createElement('span');
  val.className = 'bar-val';
  val.textContent = `${Math.round(value)}`;

  track.appendChild(fill);
  row.append(lbl, track, val);
  return row;
}

function updateUI(state: CareState): void {
  const moodEl = document.getElementById('mood')!;
  const emoji = moodEmoji(state.mood_label);
  moodEl.innerHTML = `${emoji} ${state.mood_label} (${Math.round(state.mood_score)}%)`;

  const barsEl = document.getElementById('bars')!;
  barsEl.innerHTML = '';
  barsEl.append(
    createBar('hunger', state.hunger, '#e74c3c'),
    createBar('happiness', state.happiness, '#f1c40f'),
    createBar('energy', state.energy, '#2ecc71'),
    createBar('social', state.social, '#3498db'),
  );
}

async function loadState(): Promise<void> {
  try {
    const state = await invoke<CareState>('get_care_state');
    updateUI(state);
  } catch (e) {
    const moodEl = document.getElementById('mood')!;
    moodEl.innerHTML = `<span class="error">Error: ${e}</span>`;
  }
}

document.getElementById('close-btn')!.addEventListener('click', () => {
  import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
    getCurrentWindow().close();
  });
});

document.querySelectorAll('.action-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const action = (btn as HTMLButtonElement).dataset.action!;
    try {
      playSound(action as 'feed' | 'pet' | 'chat' | 'sleep');
      const state = await invoke<CareState>('apply_care_action', { action });
      updateUI(state);
      if (state.mood_label === 'ecstatic' || state.mood_label === 'happy') {
        playSound('happy');
      }
    } catch (e) {
      console.error('[ditto] care action error:', e);
    }
  });
});

loadState();
