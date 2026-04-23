import { invoke } from '@tauri-apps/api/core';

export type PetState =
  | 'idle'
  | 'walk_left'
  | 'walk_right'
  | 'run_left'
  | 'run_right'
  | 'climb'
  | 'fall'
  | 'drag'
  | 'curious'
  | 'sit'
  | 'sleep'
  | 'talk'
  | 'happy'
  | 'sad'
  | 'eat'
  | 'play';

const WALK_SPEED = 70; // px/s
const RUN_SPEED = 140; // px/s
const GRAVITY = 980; // px/s²
const IDLE_WANDER_INTERVAL_MS = 5000;

export class PetController {
  private state: PetState = 'idle';
  private windowX: number = 0;
  private windowY: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private screenWidth: number;
  private screenHeight: number;
  private totalWidth: number;
  private petWidth: number = 64;
  private petHeight: number = 64;
  private wanderTimer: number | null = null;
  private onStateChange: ((state: PetState) => void) | null = null;
  private lastTimestamp: number = 0;
  private facingRight: boolean = true;

  constructor(onStateChange: (state: PetState) => void) {
    this.onStateChange = onStateChange;
    // Use screen properties for multi-monitor support
    this.screenWidth = window.screen.width;
    this.screenHeight = window.screen.availHeight;
    // Total available width across monitors (may be wider than primary)
    this.totalWidth = window.screen.availWidth > this.screenWidth
      ? window.screen.availWidth
      : this.screenWidth;
    this.windowX = Math.floor(this.screenWidth / 2);
    this.windowY = this.screenHeight - this.petHeight;
    this.updateWindowPosition();
  }

  getState(): PetState {
    return this.state;
  }

  getFacingRight(): boolean {
    return this.facingRight;
  }

  setState(state: PetState): void {
    if (this.state === state) return;
    this.state = state;
    switch (state) {
      case 'walk_left':
        this.velocityX = -WALK_SPEED;
        this.facingRight = false;
        break;
      case 'walk_right':
        this.velocityX = WALK_SPEED;
        this.facingRight = true;
        break;
      case 'run_left':
        this.velocityX = -RUN_SPEED;
        this.facingRight = false;
        break;
      case 'run_right':
        this.velocityX = RUN_SPEED;
        this.facingRight = true;
        break;
      case 'fall':
        this.velocityX = 0;
        break;
      case 'idle':
        this.velocityX = 0;
        break;
      case 'drag':
        this.velocityX = 0;
        this.velocityY = 0;
        break;
      default:
        this.velocityX = 0;
        break;
    }
    this.onStateChange?.(state);
  }

  update(timestamp: number): void {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      return;
    }
    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    if (dt <= 0 || dt > 0.1) return;

    if (this.state === 'fall') {
      this.velocityY += GRAVITY * dt;
      this.windowY += this.velocityY * dt;
      if (this.windowY >= this.screenHeight - this.petHeight) {
        this.windowY = this.screenHeight - this.petHeight;
        this.velocityY = 0;
        this.setState('idle');
      }
    } else if (this.state === 'walk_left' || this.state === 'walk_right' ||
               this.state === 'run_left' || this.state === 'run_right') {
      this.windowX += this.velocityX * dt;
      // Allow multi-monitor: clamp to total display bounds, not just primary
      if (this.windowX <= -this.petWidth) {
        this.windowX = -this.petWidth;
        this.setState('idle');
      }
      if (this.windowX >= this.totalWidth) {
        this.windowX = this.totalWidth;
        this.setState('idle');
      }
    }

    this.updateWindowPosition();
  }

  startDrag(): void {
    this.setState('drag');
    this.stopWandering();
  }

  updateDrag(screenX: number, screenY: number): void {
    this.windowX = screenX - this.petWidth / 2;
    this.windowY = screenY - this.petHeight / 2;
    this.updateWindowPosition();
  }

  endDrag(): void {
    this.setState('fall');
  }

  startWandering(): void {
    this.wanderTimer = window.setInterval(() => {
      if (this.state !== 'idle') return;
      const rand = Math.random();
      if (rand < 0.3) {
        this.setState('walk_right');
      } else if (rand < 0.6) {
        this.setState('walk_left');
      }
    }, IDLE_WANDER_INTERVAL_MS);
  }

  stopWandering(): void {
    if (this.wanderTimer !== null) {
      clearInterval(this.wanderTimer);
      this.wanderTimer = null;
    }
  }

  private async updateWindowPosition(): Promise<void> {
    try {
      await invoke('set_window_position', { x: Math.round(this.windowX), y: Math.round(this.windowY) });
    } catch {
      // Non-Tauri environment
    }
  }
}
