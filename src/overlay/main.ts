import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SpriteEngine } from './renderer/sprite-engine';
import { ClickThroughHandler } from './input/click-through';
import { DragHandler } from './input/drag-handler';
import { PetController } from './behavior/pet-controller';
import { openPetManager } from '../windows/pet-manager';
import { showOnboardingIfNeeded } from '../windows/onboarding';
import { setupPetActions, setupSettingsListener, setupActivityTracking, setupScheduler } from './setup-events';
import { InteractionRouter } from './interaction/interaction-router';

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

  const router = new InteractionRouter();

  const overlayContainer = document.getElementById('overlay-dom') as HTMLDivElement | null;
  if (overlayContainer) router.setOverlayContainer(overlayContainer);

  canvas.addEventListener('dblclick', () => {
    if (!router.handleGesture('double_click')) {
      openPetManager('/chat').catch((e) => console.error('[ditto] open_pet_manager error:', e));
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!router.handleGesture('context_menu')) {
      openPetManager('/care').catch((e) => console.error('[ditto] open_pet_manager error:', e));
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
  setupScheduler(router);
}

main().catch(console.error);
