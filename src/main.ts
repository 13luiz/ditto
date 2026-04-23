import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
    try {
      await toggleChatWindow();
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
}

main().catch(console.error);
