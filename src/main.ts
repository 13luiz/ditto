import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SpriteEngine } from './renderer/sprite-engine';
import { ClickThroughHandler } from './input/click-through';
import { DragHandler } from './input/drag-handler';
import { PetController } from './behavior/pet-controller';
import { toggleChatWindow } from './ui/chat-bubble';
import { openCarePanel } from './ui/care-panel';
import { openSettingsWindow } from './ui/settings';
import { checkScheduledTriggers, recordUserActivity } from './ipc/commands';

async function main() {
  try {
    await getCurrentWindow().setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
  } catch { /* not supported on all platforms */ }
  const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  try { await invoke('set_ignore_cursor_events', { ignore: false }); } catch { /* */ }

  const engine = new SpriteEngine(canvas);
  await engine.load('/pets/default/spritesheet.png', '/pets/default/animations.json');

  const controller = new PetController((state) => {
    engine.playAnimation(state);
  });

  canvas.addEventListener('dblclick', async () => {
    try {
      await toggleChatWindow();
    } catch (e) {
      console.error('[ditto] toggle_chat_window error:', e);
    }
  });

  canvas.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    try {
      await openCarePanel();
    } catch (e) {
      console.error('[ditto] open_care_panel error:', e);
    }
  });

  engine.start(controller);

  const clickThrough = new ClickThroughHandler(canvas);
  clickThrough.attach();

  const dragHandler = new DragHandler(canvas, controller, clickThrough);
  dragHandler.attach();

  controller.startWandering();

  // Handle pet actions from LLM tool calls
  listen<{ type: string; x?: number; y?: number; state?: string; emotion?: string }>('pet-action', (event) => {
    const { type, x, y, state: stateName, emotion } = event.payload;
    switch (type) {
      case 'move_to':
        if (x !== undefined && y !== undefined) {
          invoke('set_window_position', { x: Math.round(x), y: Math.round(y) });
        }
        break;
      case 'change_state':
        if (stateName) {
          engine.playAnimation(stateName);
        }
        break;
      case 'show_emotion':
        if (emotion) {
          engine.playAnimation(emotion);
        }
        break;
    }
  });

  // Handle settings open from tray menu
  listen('open_settings', () => {
    openSettingsWindow().catch(console.error);
  });

  // Record user activity on mouse interaction
  document.addEventListener('mousemove', () => { recordUserActivity().catch(() => {}); }, { passive: true });
  document.addEventListener('mousedown', () => { recordUserActivity().catch(() => {}); }, { passive: true });
  document.addEventListener('keydown', () => { recordUserActivity().catch(() => {}); }, { passive: true });

  // Scheduler tick: check triggers every 60 seconds
  const TRIGGER_MESSAGES: Record<string, string> = {
    MorningGreeting: 'Good morning! Ready for a new day?',
    BreakReminder: 'You\'ve been working for a while. Take a break!',
    IdleComment: 'Hey, are you still there?',
  };

  setInterval(async () => {
    try {
      const triggers = await checkScheduledTriggers();
      for (const t of triggers) {
        const msg = TRIGGER_MESSAGES[t];
        if (msg) {
          const { emit } = await import('@tauri-apps/api/event');
          await emit('chat-stream-token', { token: msg });
          await emit('chat-stream-done', { full_response: msg });
        }
      }
    } catch { /* scheduler tick failed silently */ }
  }, 60_000);
}

main().catch(console.error);
