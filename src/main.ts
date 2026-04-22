import { SpriteEngine } from './renderer/sprite-engine';

async function main() {
  const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  const engine = new SpriteEngine(canvas);
  await engine.load('/pets/default/spritesheet.png', '/pets/default/animations.json');
  engine.start();
}

main().catch(console.error);
