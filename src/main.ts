import { invoke } from '@tauri-apps/api/core';
import { SpriteEngine } from './renderer/sprite-engine';
import { ClickThroughHandler } from './input/click-through';
import { DragHandler } from './input/drag-handler';
import { PetController } from './behavior/pet-controller';
import { toggleChatWindow } from './ui/chat-bubble';

async function main() {
  const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  try { await invoke('set_ignore_cursor_events', { ignore: false }); } catch { /* */ }

  const engine = new SpriteEngine(canvas);
  await engine.load('/pets/default/spritesheet.png', '/pets/default/animations.json');

  const controller = new PetController((state) => {
    engine.playAnimation(state);
  });

  canvas.addEventListener('dblclick', async () => {
    console.log('[ditto] dblclick fired');
    try {
      const result = await toggleChatWindow();
      console.log('[ditto] toggle_chat_window result:', result);
    } catch (e) {
      console.error('[ditto] toggle_chat_window error:', e);
    }
  });

  engine.start(controller);

  const clickThrough = new ClickThroughHandler(canvas);
  clickThrough.attach();

  const dragHandler = new DragHandler(canvas, controller, clickThrough);
  dragHandler.attach();

  controller.startWandering();
}

main().catch(console.error);
