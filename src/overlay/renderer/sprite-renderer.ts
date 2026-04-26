import type { PetRenderer, RendererCapabilities, SkinManifest } from './pet-renderer';
import type { PetState } from '../../types/pet-state';
import { AnimationConfig, AnimationPlayer } from './animation';

export class SpriteRenderer implements PetRenderer {
  readonly type = 'sprite' as const;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spritesheet: HTMLImageElement | null = null;
  private animationConfig: AnimationConfig | null = null;
  private player: AnimationPlayer | null = null;
  private stateMap: Record<string, string> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async load(manifest: SkinManifest): Promise<void> {
    this.stateMap = manifest.state_map ?? {};
    const spriteConf = manifest.sprite;
    if (!spriteConf) throw new Error('Sprite skin manifest missing sprite config');

    const [img, configResp] = await Promise.all([
      this.loadImage(spriteConf.spritesheet),
      fetch(spriteConf.config),
    ]);
    this.spritesheet = img;
    this.animationConfig = (await configResp.json()) as AnimationConfig;
    this.player = new AnimationPlayer(this.animationConfig);

    const { frame_width, frame_height } = this.animationConfig.meta;
    this.canvas.width = frame_width;
    this.canvas.height = frame_height;
  }

  setState(state: PetState): void {
    const animName = this.stateMap[state] ?? state;
    this.player?.play(animName);
  }

  hitTest(x: number, y: number): boolean {
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return false;
    return this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] >= 10;
  }

  update(dt: number): void {
    if (!this.spritesheet || !this.animationConfig || !this.player) return;

    const { frame_width, frame_height, columns } = this.animationConfig.meta;
    const frameId = this.player.update(dt);

    const srcX = (frameId % columns) * frame_width;
    const srcY = Math.floor(frameId / columns) * frame_height;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.spritesheet,
      srcX, srcY, frame_width, frame_height,
      0, 0, frame_width, frame_height
    );
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  capabilities(): RendererCapabilities {
    return {
      lipSync: false,
      expressionBlending: false,
      parameterDriving: false,
      physics: false,
      multiLayer: false,
    };
  }

  destroy(): void {
    this.spritesheet = null;
    this.animationConfig = null;
    this.player = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
