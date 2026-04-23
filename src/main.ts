import { SpriteEngine } from './renderer/sprite-engine';
import { ClickThroughHandler } from './input/click-through';
import { DragHandler } from './input/drag-handler';
import { PetController } from './behavior/pet-controller';
import { ChatBubble, createChatStyles } from './ui/chat-bubble';

async function main() {
  const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  const app = document.getElementById('app') as HTMLDivElement;
  if (!app) throw new Error('App element not found');

  document.head.appendChild(createChatStyles());

  const engine = new SpriteEngine(canvas);
  await engine.load('/pets/default/spritesheet.png', '/pets/default/animations.json');

  const controller = new PetController((state) => {
    engine.playAnimation(state);
  });

  const chatBubble = new ChatBubble((message) => {
    console.log('Chat message sent:', message);
  });
  chatBubble.mount(app);

  canvas.addEventListener('dblclick', () => {
    chatBubble.toggle();
  });

  engine.start(controller);

  const clickThrough = new ClickThroughHandler(canvas);
  clickThrough.attach();

  const dragHandler = new DragHandler(canvas, controller);
  dragHandler.attach();

  controller.startWandering();
}

main().catch(console.error);
