import { invoke } from '@tauri-apps/api/core';
import { currentMonitor, availableMonitors, getCurrentWindow } from '@tauri-apps/api/window';

export type PetState =
  | 'idle' | 'walk_left' | 'walk_right' | 'run_left' | 'run_right'
  | 'climb' | 'fall' | 'drag' | 'curious' | 'sit' | 'sleep'
  | 'talk' | 'happy' | 'sad' | 'eat' | 'play';

const WALK_SPEED = 100;
const RUN_SPEED = 200;
const GRAVITY = 1400;
const IDLE_WANDER_INTERVAL_MS = 5000;

interface MonitorXRange { xStart: number; xEnd: number; }

export class PetController {
  private state: PetState = 'idle';
  private windowX = 0;
  private windowY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private groundY = 0;       // physical, from currentMonitor
  private monitorRanges: MonitorXRange[] = [];
  private petWidth = 64;
  private petHeight = 64;
  private scaleFactor = 1;   // current monitor's DPI scale
  private wanderTimer: number | null = null;
  private onStateChange: ((s: PetState) => void) | null = null;
  private lastTimestamp = 0;
  private facingRight = true;
  private monitorFrameCounter = 0;
  private userPlaced = false;  // true when user dragged to non-ground position

  constructor(onStateChange: (s: PetState) => void) {
    this.onStateChange = onStateChange;
    this.groundY = 800;
    this.monitorRanges = [{ xStart: 0, xEnd: 1920 }];
    this.windowX = 960;
    this.windowY = this.groundY - this.physH();
    this.init();
  }

  /** Physical window height in screen pixels */
  private physH(): number { return Math.round(this.petHeight * this.scaleFactor); }
  /** Physical window width in screen pixels */
  private physW(): number { return Math.round(this.petWidth * this.scaleFactor); }

  private async init() {
    await this.refreshGround();
    await this.loadRanges();
    this.windowX = Math.floor((this.monitorRanges[0].xStart + this.monitorRanges[0].xEnd) / 2);
    this.windowY = this.groundY - this.physH();
    this.updateWindowPosition();
  }

  private async refreshGround() {
    try {
      const mon = await currentMonitor();
      if (mon) {
        this.groundY = mon.workArea.position.y + mon.workArea.size.height;
      }
      this.scaleFactor = await getCurrentWindow().scaleFactor();
    } catch { /* */ }
  }

  private async loadRanges() {
    try {
      const mons = await availableMonitors();
      if (mons.length > 0) {
        this.monitorRanges = mons.map(m => ({
          xStart: m.position.x,
          xEnd: m.position.x + m.size.width,
        }));
      }
    } catch { /* */ }
  }

  private currentRange(): MonitorXRange {
    const cx = this.windowX + this.physW() / 2;
    for (const r of this.monitorRanges) {
      if (cx >= r.xStart && cx < r.xEnd) return r;
    }
    return this.monitorRanges[0];
  }

  getState() { return this.state; }
  getFacingRight() { return this.facingRight; }

  setState(s: PetState) {
    if (this.state === s) return;
    this.state = s;
    switch (s) {
      case 'walk_left':  this.velocityX = -WALK_SPEED; this.facingRight = false; break;
      case 'walk_right': this.velocityX = WALK_SPEED;  this.facingRight = true;  break;
      case 'run_left':   this.velocityX = -RUN_SPEED;  this.facingRight = false; break;
      case 'run_right':  this.velocityX = RUN_SPEED;   this.facingRight = true;  break;
      case 'fall':  this.velocityX = 0; break;
      case 'idle':  this.velocityX = 0; break;
      case 'drag':  this.velocityX = 0; this.velocityY = 0; break;
      default:      this.velocityX = 0; break;
    }
    this.onStateChange?.(s);
  }

  update(ts: number) {
    if (this.lastTimestamp === 0) { this.lastTimestamp = ts; return; }
    const dt = (ts - this.lastTimestamp) / 1000;
    this.lastTimestamp = ts;
    if (dt <= 0 || dt > 0.1) return;

    // Refresh ground from currentMonitor every ~1s
    this.monitorFrameCounter++;
    if (this.monitorFrameCounter >= 60) {
      this.monitorFrameCounter = 0;
      this.refreshGround();
    }

    const ground = this.groundY - this.physH();
    const range = this.currentRange();

    if (this.state === 'fall') {
      this.velocityY += GRAVITY * dt;
      this.windowY += this.velocityY * dt;
      if (this.windowY >= ground) {
        this.windowY = ground;
        this.velocityY = 0;
        this.setState('idle');
      }
    } else if (this.state === 'walk_left' || this.state === 'walk_right' ||
               this.state === 'run_left' || this.state === 'run_right') {
      if (this.userPlaced) {
        // Don't move when user has placed the pet at a custom position
        this.setState('idle');
      } else {
        this.windowX += this.velocityX * dt;
        this.windowY = ground;
        // Clamp to current monitor's edges
        if (this.windowX < range.xStart) {
          this.windowX = range.xStart;
          this.setState('idle');
        }
        if (this.windowX + this.physW() > range.xEnd) {
          this.windowX = range.xEnd - this.physW();
          this.setState('idle');
        }
      }
    } else if (this.state === 'idle') {
      if (!this.userPlaced) {
        this.windowY = ground;
      }
    }

    this.updateWindowPosition();
  }

  startDrag() { this.setState('drag'); this.stopWandering(); }

  updateDrag(physX: number, physY: number) {
    this.windowX = physX - this.physW() / 2;
    this.windowY = physY - this.physH() / 2;
    this.updateWindowPosition();
  }

  endDrag() {
    this.refreshGround();
    this.stopWandering();
    const ground = this.groundY - this.physH();
    if (this.windowY >= ground - 10) {
      this.windowY = ground;
      this.userPlaced = false;
      this.startWandering();
    } else {
      this.userPlaced = true;
    }
    this.setState('idle');
  }

  startWandering() {
    this.wanderTimer = window.setInterval(() => {
      if (this.state !== 'idle') return;
      if (Math.random() < 0.6) {
        this.setState(Math.random() < 0.5 ? 'walk_right' : 'walk_left');
      }
    }, IDLE_WANDER_INTERVAL_MS);
  }

  stopWandering() {
    if (this.wanderTimer !== null) { clearInterval(this.wanderTimer); this.wanderTimer = null; }
  }

  private async updateWindowPosition() {
    try {
      await invoke('set_window_position', { x: Math.round(this.windowX), y: Math.round(this.windowY) });
    } catch { /* */ }
  }
}
