import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SpriteEngine } from './renderer/sprite-engine';
import { ClickThroughHandler } from './input/click-through';
import { DragHandler } from './input/drag-handler';
import { PetController } from './behavior/pet-controller';
import { toggleChatWindow } from '../windows/chat-bubble';
import { openCarePanel } from '../windows/care-panel';
import { showOnboardingIfNeeded } from '../windows/onboarding';
import { setupPetActions, setupSettingsListener, setupActivityTracking, setupScheduler } from './setup-events';

async function main() {
  try {
    await getCurrentWindow().setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[ditto] setBackgroundColor failed:', e);
  }
  const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  try { await invoke('set_ignore_cursor_events', { ignore: false }); } catch (e) { if (import.meta.env.DEV) console.warn('[ditto] set_ignore_cursor_events failed:', e); }

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
  clickThrough.setCursorDistanceCallback((dist) => {
    controller.updateCursorDistance(dist);
  });
  clickThrough.attach();

  const dragHandler = new DragHandler(canvas, controller, clickThrough);
  dragHandler.attach();

  controller.startWandering();
  showOnboardingIfNeeded().catch(console.error);

  setupPetActions(engine);
  setupSettingsListener();
  setupActivityTracking();
  setupScheduler();
}

main().catch(console.error);
