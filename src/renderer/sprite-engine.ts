import { AnimationConfig, AnimationPlayer } from './animation';
import { PetController } from '../behavior/pet-controller';

export class SpriteEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spritesheet: HTMLImageElement | null = null;
  private animationConfig: AnimationConfig | null = null;
  private player: AnimationPlayer | null = null;
  private lastTime: number = 0;
  private running: boolean = false;
  private controller: PetController | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async load(spriteUrl: string, configUrl: string): Promise<void> {
    const [img, configResp] = await Promise.all([
      this.loadImage(spriteUrl),
      fetch(configUrl),
    ]);
    this.spritesheet = img;
    this.animationConfig = (await configResp.json()) as AnimationConfig;
    this.player = new AnimationPlayer(this.animationConfig);

    const { frame_width, frame_height } = this.animationConfig.meta;
    this.canvas.width = frame_width;
    this.canvas.height = frame_height;
  }

  start(controller?: PetController): void {
    if (this.running) return;
    this.controller = controller ?? null;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  playAnimation(name: string): void {
    this.player?.play(name);
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.controller) {
      this.controller.update(timestamp);
    }

    this.render(dt);
    requestAnimationFrame((t) => this.loop(t));
  }

  render(dtMs: number): void {
    if (!this.spritesheet || !this.animationConfig || !this.player) return;

    const { frame_width, frame_height, columns } = this.animationConfig.meta;
    const frameId = this.player.update(dtMs);

    const srcX = (frameId % columns) * frame_width;
    const srcY = Math.floor(frameId / columns) * frame_height;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.spritesheet,
      srcX, srcY, frame_width, frame_height,
      0, 0, frame_width, frame_height
    );
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
}
