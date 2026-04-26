import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { SpriteEngine } from './renderer/sprite-engine';
import { openPetManager } from '../windows/pet-manager';
import { checkScheduledTriggers, recordUserActivity } from '../ipc/commands';
import type { InteractionRouter } from './interaction/interaction-router';

export function setupPetActions(engine: SpriteEngine): void {
  listen<{ type: string; x?: number; y?: number; state?: string; emotion?: string }>('pet-action', (event) => {
    const { type, x, y, state: stateName, emotion } = event.payload;
    switch (type) {
      case 'move_to':
        if (x !== undefined && y !== undefined) {
          invoke('set_window_position', { x: Math.round(x), y: Math.round(y) });
        }
        break;
      case 'change_state':
        if (stateName) engine.playAnimation(stateName);
        break;
      case 'show_emotion':
        if (emotion) engine.playAnimation(emotion);
        break;
    }
  });
}

export function setupSettingsListener(): void {
  listen('open_pet_manager', () => {
    openPetManager('/settings').catch(console.error);
  });
}

export function setupActivityTracking(): void {
  const track = () => { recordUserActivity().catch(() => {}); };
  document.addEventListener('mousemove', track, { passive: true });
  document.addEventListener('mousedown', track, { passive: true });
  document.addEventListener('keydown', track, { passive: true });
}

const TRIGGER_MESSAGES: Record<string, string> = {
  MorningGreeting: 'Good morning! Ready for a new day?',
  BreakReminder: 'You\'ve been working for a while. Take a break!',
  IdleComment: 'Hey, are you still there?',
};

export function setupScheduler(router?: InteractionRouter): void {
  setInterval(async () => {
    try {
      const triggers = await checkScheduledTriggers();
      for (const t of triggers) {
        const msg = TRIGGER_MESSAGES[t];
        if (msg) {
          if (router) router.handleOutput({ kind: 'agent_text', text: msg, streaming: false });
          await emit('chat-stream-token', { token: msg });
          await emit('chat-stream-done', { full_response: msg });
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[ditto] scheduler tick failed:', e);
    }
  }, 60_000);
}
