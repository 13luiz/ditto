import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

let panel: HTMLDivElement | null = null;

interface CareState {
  hunger: number;
  happiness: number;
  energy: number;
  social: number;
  mood_score: number;
  mood_label: string;
}

function createBar(label: string, value: number, color: string): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';

  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.cssText = 'width:64px;font-size:11px;color:#ccc;text-transform:capitalize;';

  const track = document.createElement('div');
  track.style.cssText = 'flex:1;height:10px;background:#333;border-radius:5px;overflow:hidden;';

  const fill = document.createElement('div');
  fill.style.cssText = `height:100%;width:${value}%;background:${color};border-radius:5px;transition:width 0.3s;`;

  const val = document.createElement('span');
  val.textContent = `${Math.round(value)}`;
  val.style.cssText = 'width:28px;font-size:10px;color:#aaa;text-align:right;';

  track.appendChild(fill);
  row.append(lbl, track, val);
  return row;
}

function createButton(label: string, action: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = 'flex:1;padding:4px 0;border:1px solid #555;border-radius:6px;background:#2a2a2a;color:#ddd;font-size:11px;cursor:pointer;';
  btn.addEventListener('mouseenter', () => { btn.style.background = '#444'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#2a2a2a'; });
  btn.addEventListener('click', async () => {
    try {
      const state = await invoke<CareState>('apply_care_action', { action });
      updatePanel(state);
    } catch (e) {
      console.error('[ditto] care action error:', e);
    }
  });
  return btn;
}

function updatePanel(state: CareState): void {
  if (!panel) return;

  const bars = panel.querySelector('.care-bars') as HTMLDivElement;
  bars.innerHTML = '';
  bars.append(
    createBar('hunger', state.hunger, '#e74c3c'),
    createBar('happiness', state.happiness, '#f1c40f'),
    createBar('energy', state.energy, '#2ecc71'),
    createBar('social', state.social, '#3498db'),
  );

  const moodEl = panel.querySelector('.care-mood') as HTMLDivElement;
  const emoji = moodEmoji(state.mood_label);
  moodEl.innerHTML = `${emoji} ${state.mood_label} (${Math.round(state.mood_score)}%)`;
}

function moodEmoji(label: string): string {
  switch (label) {
    case 'ecstatic': return '\u{1F929}';
    case 'happy': return '\u{1F60A}';
    case 'content': return '\u{1F60C}';
    case 'neutral': return '\u{1F610}';
    case 'sad': return '\u{1F622}';
    case 'miserable': return '\u{1F629}';
    default: return '\u{1F610}';
  }
}

export async function openCarePanel(): Promise<void> {
  if (panel) {
    panel.remove();
    panel = null;
    return;
  }

  let state: CareState;
  try {
    state = await invoke<CareState>('get_care_state');
  } catch (e) {
    console.error('[ditto] get_care_state error:', e);
    return;
  }

  const petWin = getCurrentWindow();

  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:4px;left:4px;width:210px;background:#1e1e1eee;border:1px solid #444;border-radius:10px;padding:10px;font-family:system-ui,sans-serif;z-index:9999;color:#fff;user-select:none;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:bold;margin-bottom:6px;color:#fff;';
  title.textContent = 'Ditto Care';

  const moodDiv = document.createElement('div');
  moodDiv.className = 'care-mood';
  moodDiv.style.cssText = 'font-size:13px;margin-bottom:8px;text-align:center;';
  const emoji = moodEmoji(state.mood_label);
  moodDiv.innerHTML = `${emoji} ${state.mood_label} (${Math.round(state.mood_score)}%)`;

  const barsDiv = document.createElement('div');
  barsDiv.className = 'care-bars';
  barsDiv.append(
    createBar('hunger', state.hunger, '#e74c3c'),
    createBar('happiness', state.happiness, '#f1c40f'),
    createBar('energy', state.energy, '#2ecc71'),
    createBar('social', state.social, '#3498db'),
  );

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:4px;margin-top:8px;';
  btnRow.append(
    createButton('Feed', 'feed'),
    createButton('Pet', 'pet'),
    createButton('Chat', 'chat'),
    createButton('Sleep', 'sleep'),
  );

  const closeBtn = document.createElement('div');
  closeBtn.style.cssText = 'text-align:right;font-size:10px;color:#666;cursor:pointer;margin-top:6px;';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('click', () => {
    if (panel) { panel.remove(); panel = null; }
  });

  panel.append(title, moodDiv, barsDiv, btnRow, closeBtn);
  document.body.appendChild(panel);

  try {
    const pos = await petWin.outerPosition();
    const scale = await petWin.scaleFactor();
    const panelEl = panel;
    panelEl.style.position = 'fixed';
    panelEl.style.top = '-60px';
    panelEl.style.left = `${64 - 105}px`;
  } catch { /* fallback to default position */ }
}

export function closeCarePanel(): void {
  if (panel) {
    panel.remove();
    panel = null;
  }
}
