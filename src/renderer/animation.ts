export interface AnimationDef {
  frames: number[];
  fps: number;
  loop: boolean;
  next: string | null;
}

export interface AnimationConfig {
  meta: {
    frame_width: number;
    frame_height: number;
    columns: number;
  };
  animations: Record<string, AnimationDef>;
  transitions: Record<string, AnimationDef>;
}

export class AnimationPlayer {
  private config: AnimationConfig;
  private currentAnim: string;
  private frameIndex: number;
  private elapsed: number;
  private transitioning: boolean;

  constructor(config: AnimationConfig) {
    this.config = config;
    this.currentAnim = 'idle';
    this.frameIndex = 0;
    this.elapsed = 0;
    this.transitioning = false;
  }

  play(name: string): void {
    if (this.currentAnim === name) return;
    this.currentAnim = name;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.transitioning = false;
  }

  update(dtMs: number): number {
    const anim = this.getAnimation();
    if (!anim || anim.frames.length === 0) return 0;

    this.elapsed += dtMs;
    const frameDuration = 1000 / anim.fps;

    if (this.elapsed >= frameDuration) {
      const framesToAdvance = Math.floor(this.elapsed / frameDuration);
      this.elapsed -= framesToAdvance * frameDuration;
      this.frameIndex += framesToAdvance;

      if (this.frameIndex >= anim.frames.length) {
        if (anim.loop) {
          this.frameIndex = this.frameIndex % anim.frames.length;
        } else {
          this.frameIndex = anim.frames.length - 1;
          if (anim.next) {
            this.play(anim.next);
          }
        }
      }
    }

    return anim.frames[this.frameIndex];
  }

  get currentAnimation(): string {
    return this.currentAnim;
  }

  get currentFrameIndex(): number {
    return this.frameIndex;
  }

  private getAnimation(): AnimationDef | undefined {
    return this.config.animations[this.currentAnim];
  }
}
